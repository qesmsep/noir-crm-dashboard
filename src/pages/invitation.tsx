import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  Box, 
  VStack, 
  Heading, 
  Text, 
  Input, 
  Textarea, 
  Button, 
  FormControl, 
  FormLabel, 
  FormErrorMessage,
  useToast, 
  HStack,
  Progress,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Divider,
  Spinner,
} from '@chakra-ui/react';
import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons';

interface FormData {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  company: string;
  city_state: string;
  referral: string;
  visit_frequency: string;
  go_to_drink: string;
}

const InvitationQuestionnaire = () => {
  const router = useRouter();
  const { token } = router.query;
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<FormData>({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    company: '',
    city_state: '',
    referral: '',
    visit_frequency: '',
    go_to_drink: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isValid, setIsValid] = useState(false);
  const toast = useToast();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const steps = [
    {
      title: "You're one step closer.",
      description: "Request an invitation by completing a short questionnaire for consideration and access.",
      type: 'intro'
    },
    {
      title: "Member Information",
      description: "Please provide your information.",
      fields: [
        { name: 'first_name', label: 'First Name', type: 'text', required: true },
        { name: 'last_name', label: 'Last Name', type: 'text', required: true },
        { name: 'phone', label: 'Phone Number', type: 'phone', required: true },
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'company', label: 'Company', type: 'text', required: true }
      ]
    },
    {
      title: "Location",
      description: "We're exploring where to bring the Noir experience next.\n \nWhat city and state do you call home?",
      fields: [
        { name: 'city_state', label: 'City and State', type: 'text', required: true }
      ]
    },
    {
      title: "Referral",
      description: "Who referred you to become a Noir Member? \n\n While not required, it definitely helps to have a Noir Member as a referral. Otherwise, please state how you heard about the Noir Membership.",
      fields: [
        { name: 'referral', label: 'Referral or How You Heard About Us', type: 'textarea', required: true }
      ]
    },
    {
      title: "Visit Frequency",
      description: "How often do you see yourself visiting Noir?",
      fields: [
        { name: 'visit_frequency', label: 'Visit Frequency', type: 'text', required: true }
      ]
    },
    {
      title: "Go-to Drink",
      description: "What's your go-to drink order?",
      fields: [
        { name: 'go_to_drink', label: 'Go-to Drink', type: 'text', required: true }
      ]
    },
    {
      title: "Thank You",
      description: "Thank you.\n\n Your request has been received and we typically respond within 72 hours. \n\nPlease respond to the text message you'll receive if you have any additional questions.",
      type: 'thankyou'
    },
    {
      title: "FAQ",
      description: "Your request has been received. You'll be notified of our decision soon.",
      type: 'faq'
    }
  ];

  const faqItems = [
    {
      question: "What happens to unused beverage credit?",
      answer: "Your beverage credit rolls over month-to-month."
    },
    {
      question: "What can I use the credit for?",
      answer: "Your monthly credit covers your time at Noir—for you and your guests. All orders can go on your house account, so you can settle tabs however you prefer."
    },
    {
      question: "Can my guests visit without me?",
      answer: "Guests must be accompanied by a Noir Member. You may add a partner via the Duo account for $25/month -- Partners receive the same member benefits under your house account. Currently only one partner per account."
    },
    {
      question: "How do I make reservations?",
      answer: "Simply text us or use the traditional online system. We'll confirm availability and hold your spot. Currently, we're accepting reservations up to 2 weeks out."
    },
    {
      question: "How do Noir events work?",
      answer: "Events are ticketed and available first come, first served. We try to host 2+ curated gatherings each month depending on the season."
    },
    {
      question: "Is there a minimum commitment?",
      answer: "Nope. Cancel anytime. Memberships and dues paid are non-refundable."
    },
    {
      question: "What if I spend more than my credit?",
      answer: "No problem. Any overages are applied to your house account and settled before your next renewal."
    },
    {
      question: "Can I transfer or gift my credit?",
      answer: "Credit is non-transferable and for member use only."
    }
  ];

  useEffect(() => {
    // No longer need to validate token - form is open to anyone
    setLoading(false);
  }, []);

  useEffect(() => {
    validateCurrentStep();
  }, [formData, currentStep, errors]);

  useEffect(() => {
    // Hide main nav/header on mobile for this page only
    if (isMobile) {
      const nav = document.querySelector('nav');
      if (nav) nav.style.display = 'none';
    }
    return () => {
      if (isMobile) {
        const nav = document.querySelector('nav');
        if (nav) nav.style.display = '';
      }
    };
  }, [isMobile]);


  const validateCurrentStep = () => {
    const currentStepData = steps[currentStep];
    
    if (currentStepData.type === 'intro' || currentStepData.type === 'thankyou' || currentStepData.type === 'faq') {
      setIsValid(true);
      return;
    }

    if (!currentStepData.fields) {
      setIsValid(false);
      return;
    }

    const requiredFields = currentStepData.fields.filter(field => field.required);
    const isValidStep = requiredFields.every(field => {
      const value = formData[field.name as keyof FormData];
      if (!value || value.trim() === '') return false;
      
      // Additional validation for email and phone on current step
      if (field.name === 'email' && !validateEmail(value)) return false;
      if (field.name === 'phone' && !validatePhone(value)) return false;
      
      return true;
    });

    setIsValid(isValidStep);
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string) => {
    // Remove all non-digits for validation
    const digits = phone.replace(/\D/g, '');
    // Check if it's a valid US phone number (10 or 11 digits)
    return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
  };

  const validateAllRequiredFields = () => {
    // Get all required fields from all steps
    const allRequiredFields = steps
      .filter(step => step.fields)
      .flatMap(step => step.fields!.filter(field => field.required))
      .map(field => field.name);

    // Check if all required fields are filled and valid
    const allFieldsValid = allRequiredFields.every(fieldName => {
      const value = formData[fieldName as keyof FormData];
      if (!value || value.trim() === '') return false;
      
      // Additional validation for email and phone
      if (fieldName === 'email' && !validateEmail(value)) return false;
      if (fieldName === 'phone' && !validatePhone(value)) return false;
      
      return true;
    });

    return allFieldsValid;
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }

    // Validate email in real-time
    if (field === 'email' && value) {
      if (!validateEmail(value)) {
        setErrors(prev => ({
          ...prev,
          email: 'Please enter a valid email address'
        }));
      } else {
        setErrors(prev => ({
          ...prev,
          email: ''
        }));
      }
    }
  };

  const formatPhoneNumber = (phone: string) => {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    
    // If it's a 10-digit number, format as (XXX) XXX-XXXX
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    
    // If it's an 11-digit number starting with 1, format as +1 (XXX) XXX-XXXX
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+1${digits.slice(1)}`;
    }
    
    // If it's already in international format, return as is
    if (phone.startsWith('+')) {
      return phone;
    }
    
    // Otherwise, return the original input
    return phone;
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value);
    handleInputChange('phone', formatted);
    
    // Validate phone number
    if (value && !validatePhone(formatted)) {
      setErrors(prev => ({
        ...prev,
        phone: 'Please enter a valid phone number'
      }));
    } else {
      setErrors(prev => ({
        ...prev,
        phone: ''
      }));
    }
  };

  const handleNext = () => {
    // Only allow proceeding if current step is valid
    if (currentStep < steps.length - 1 && isValid) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    // Validate all required fields before submitting
    if (!validateAllRequiredFields()) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields before submitting.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
      setSubmitting(false);
      return;
    }

    setSubmitting(true);
    
    try {
      // Format phone number to international format
      const phoneDigits = formData.phone.replace(/\D/g, '');
      const formattedPhone = phoneDigits.length === 10 ? `+1${phoneDigits}` : 
                           phoneDigits.length === 11 && phoneDigits.startsWith('1') ? `+${phoneDigits}` :
                           phoneDigits.startsWith('+') ? phoneDigits : `+1${phoneDigits}`;

      const submitData = {
        ...formData,
        phone: formattedPhone
      };

      const response = await fetch('/api/invitation/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Your invitation request has been submitted successfully.',
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
        setCurrentStep(currentStep + 1);
      } else {
        throw new Error(data.error || 'Failed to submit request');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit your request. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box 
        minH="100vh" 
        fontFamily="Montserrat, sans-serif"
        background="linear-gradient(rgba(53,53,53,0.6), rgba(53,53,53,0.6)), url('/images/LPR67899.JPG') center/cover no-repeat"
        backgroundAttachment="fixed"
        position="relative"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <VStack spacing={4}>
          <Spinner size="xl" color="#a59480" />
          <Text color="#ECEDE8" fontSize="lg">Loading invitation request...</Text>
        </VStack>
      </Box>
    );
  }



  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <Box 
      minH="100vh" 
      fontFamily="Montserrat, sans-serif"
      background="linear-gradient(rgba(53,53,53,0.6), rgba(53,53,53,0.6)), url('/images/LPR67899.JPG') center/cover no-repeat"
      backgroundAttachment="fixed"
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      w="100%"
      h="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      overflow="hidden"
      px={0}
    >
      <Box 
        maxW={{ base: '98vw', md: '500px' }}
        w="90%"
        mx="auto"
        bg="rgba(0, 0, 0, 0.8)"
        borderRadius="1rem"
        px={{ base: 3, md: 8 }}
        py={{ base: 4, md: 10 }}
        boxShadow="0 4px 6px rgba(0, 0, 0, 0.1)"
        position="relative"
        zIndex={10}
      >
        {/* Progress Bar */}
        <Progress 
          value={progress} 
          colorScheme="yellow" 
          bg="rgba(255, 255, 255, 0.1)"
          borderRadius="10px"
          mb={6}
          size="sm"
        />

        {/* Step Content */}
        <VStack spacing={6} align="stretch">
          <Heading 
            size="lg" 
            color="#ECEDE8" 
            fontFamily="IvyJournal-Thin, sans-serif"
            textAlign="center"
            mb={2}
          >
            {currentStepData.title}
          </Heading>
          
          <Text 
            color="#ECEDE8" 
            fontFamily="Montserrat, sans-serif"
            textAlign="center"
            opacity={0.8}
            mb={6}
            padding="25px"
            whiteSpace="pre-line"
          >
            {currentStepData.description}
          </Text>

          {/* Intro Step */}
          {currentStepData.type === 'intro' && (
            <VStack spacing={6}>
              <Text color="#ECEDE8" fontSize="lg" textAlign="center">
              </Text>
            </VStack>
          )}

          {/* Form Fields */}
          {currentStepData.fields && (
            <VStack spacing={6} align="center" w="95%">
              {currentStepData.fields.map((field) => (
                <FormControl key={field.name} isRequired={field.required} w="90%" maxW="500px" isInvalid={!!errors[field.name]}>
                  {field.type === 'textarea' ? (
                    <>
                      <Textarea 
                        value={formData[field.name as keyof FormData] || ''} 
                        onChange={(e) => handleInputChange(field.name, e.target.value)}
                        fontFamily="Montserrat, sans-serif" 
                        placeholder={field.label}
                        bg="rgba(255, 255, 255, 0.9)"
                        border="1px solid rgba(255, 255, 255, 0.2)"
                        borderRadius="0.5rem"
                        _focus={{
                          borderColor: "#a59480",
                          boxShadow: "0 0 0 1px #a59480"
                        }}
                        color="#353535"
                        minH="100px"
                        fontSize="md"
                        p={4}
                        w="100%"
                      />
                      {errors[field.name] && (
                        <FormErrorMessage color="red.400" fontSize="sm">
                          {errors[field.name]}
                        </FormErrorMessage>
                      )}
                    </>
                  ) : field.type === 'phone' ? (
                    <>
                      <Input 
                        type="tel" 
                        value={formData[field.name as keyof FormData] || ''} 
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        fontFamily="Montserrat, sans-serif" 
                        placeholder="(555) 555-5555"
                        bg="rgba(255, 255, 255, 0.9)"
                        border="1px solid rgba(255, 255, 255, 0.2)"
                        borderRadius="0.5rem"
                        _focus={{
                          borderColor: "#a59480",
                          boxShadow: "0 0 0 1px #a59480"
                        }}
                        color="#353535"
                        h="50px"
                        fontSize="md"
                        p={4}
                        w="100%"
                      />
                      {errors[field.name] && (
                        <FormErrorMessage color="#CAC2B9" fontSize="sm">
                          {errors[field.name]}
                        </FormErrorMessage>
                      )}
                    </>
                  ) : field.type === 'email' ? (
                    <>
                      <Input 
                        type="email" 
                        value={formData[field.name as keyof FormData] || ''} 
                        onChange={(e) => handleInputChange(field.name, e.target.value)}
                        fontFamily="Montserrat, sans-serif" 
                        placeholder="your@email.com"
                        bg="rgba(255, 255, 255, 0.9)"
                        border="1px solid rgba(255, 255, 255, 0.2)"
                        borderRadius="0.5rem"
                        _focus={{
                          borderColor: "#a59480",
                          boxShadow: "0 0 0 1px #a59480"
                        }}
                        color="#353535"
                        h="50px"
                        fontSize="md"
                        p={4}
                        w="100%"
                      />
                      {errors[field.name] && (
                        <FormErrorMessage color="#CAC2B9" fontSize="sm">
                          {errors[field.name]}
                        </FormErrorMessage>
                      )}
                    </>
                  ) : (
                    <>
                      <Input 
                        value={formData[field.name as keyof FormData] || ''} 
                        onChange={(e) => handleInputChange(field.name, e.target.value)}
                        fontFamily="Montserrat, sans-serif" 
                        placeholder={field.label}
                        bg="rgba(255, 255, 255, 0.9)"
                        border="1px solid rgba(255, 255, 255, 0.2)"
                        borderRadius="0.5rem"
                        _focus={{
                          borderColor: "#a59480",
                          boxShadow: "0 0 0 1px #a59480"
                        }}
                        color="#353535"
                        h="50px"
                        fontSize="md"
                        p={4}
                        w="100%"
                      />
                      {errors[field.name] && (
                        <FormErrorMessage color="#CAC2B9" fontSize="sm">
                          {errors[field.name]}
                        </FormErrorMessage>
                      )}
                    </>
                  )}
                </FormControl>
              ))}
            </VStack>
          )}

          {/* Thank You Step */}
          {currentStepData.type === 'thankyou' && (
            <VStack spacing={6}>
              <Text color="#ECEDE8" fontSize="lg" textAlign="center">
              </Text>
            </VStack>
          )}

          {/* FAQ Step */}
          {currentStepData.type === 'faq' && (
            <VStack spacing={6} align="stretch">
              <Text color="#ECEDE8" fontSize="lg" textAlign="center" mb={4}>
                Frequently Asked Questions
              </Text>
              
              <Accordion allowToggle>
                {faqItems.map((item, index) => (
                  <AccordionItem key={index} border="none" mb={4} margin="10px">
                    <AccordionButton 
                      bg="rgba(255, 255, 255, 0.1)"
                      borderRadius="0.5rem"
                      _hover={{ bg: "rgba(255, 255, 255, 0.15)" }}
                      color="#ECEDE8"
                      fontFamily="Montserrat, sans-serif"
                      py={6}
                      px={4}
                      fontSize="md"
                    >
                      <Box flex="1" textAlign="left" w="80%">
                        {item.question}
                      </Box>
                      <AccordionIcon color="#a59480" />
                    </AccordionButton>
                    <AccordionPanel 
                      bg="rgba(255, 255, 255, 0.05)"
                      borderRadius="0 0 0.5rem 0.5rem"
                      color="#ECEDE8"
                      fontFamily="Montserrat, sans-serif"
                      pt={6}
                      pb={6}
                      px={4}
                    >
                      {item.answer}
                    </AccordionPanel>
                  </AccordionItem>
                ))}
              </Accordion>
            </VStack>
          )}

          {/* Navigation Buttons */}
          <HStack justify="space-between" padding="10px">
            <Button
              leftIcon={<ChevronLeftIcon />}
              onClick={handlePrevious}
              disabled={currentStep === 0}
              bg="#CAC2B9"
              color="#353535"
              borderColor="#CAC2B9"
              _hover={{
                bg: "#b3a89c",
                borderColor: "#b3a89c"
              }}
              fontFamily="Montserrat, sans-serif"
              borderRadius="10px"
              px={10}
              py={4}
              fontSize="lg"
            >
              PREVIOUS
            </Button>

            {currentStep === steps.length - 2 && currentStepData.type === 'thankyou' ? (
              <Button
                rightIcon={<ChevronRightIcon />}
                onClick={handleNext}
                bg="#CAC2B9"
                color="#353535"
                _hover={{ bg: "#b3a89c" }}
                fontFamily="Montserrat, sans-serif"
                borderRadius="10px"
                px={10}
                py={4}
                fontSize="lg"
              >
                VIEW FAQ
              </Button>
            ) : currentStep === steps.length - 1 ? (
              <Button
                onClick={() => window.close()}
                bg="#CAC2B9"
                color="#353535"
                _hover={{ bg: "#b3a89c" }}
                fontFamily="Montserrat, sans-serif"
                borderRadius="10px"
                px={10}
                py={4}
                fontSize="lg"
              >
                CLOSE
              </Button>
            ) : currentStep === steps.length - 3 ? (
              (() => {
                const allFieldsValid = validateAllRequiredFields();
                return allFieldsValid ? (
                  <Button
                    onClick={handleSubmit}
                    isLoading={submitting}
                    bg="#CAC2B9"
                    color="#353535"
                    _hover={{ bg: "#b3a89c" }}
                    fontFamily="Montserrat, sans-serif"
                    borderRadius="10px"
                    px={10}
                    py={4}
                    fontSize="lg"
                  >
                    SUBMIT
                  </Button>
                ) : (
                  <Button
                    disabled
                    bg="rgba(165, 148, 128, 0.5)"
                    color="#ECEDE8"
                    fontFamily="Montserrat, sans-serif"
                    title="Please complete all previous steps before submitting"
                    borderRadius="10px"
                    px={10}
                    py={4}
                    fontSize="lg"
                  >
                    Complete All Steps First
                  </Button>
                );
              })()
            ) : (
              <Button
                rightIcon={<ChevronRightIcon />}
                onClick={handleNext}
                disabled={!isValid}
                bg={isValid ? "#CAC2B9" : "rgba(165, 148, 128, 0.5)"}
                color="#353535"
                _hover={{
                  bg: isValid ? "#b3a89c" : "rgba(165, 148, 128, 0.5)"
                }}
                fontFamily="Montserrat, sans-serif"
                borderRadius="10px"
                px={10}
                py={4}
                
                fontSize="lg"
              >
                NEXT
              </Button>
            )}
          </HStack>
        </VStack>
      </Box>
    </Box>
  );
};

export default InvitationQuestionnaire; 