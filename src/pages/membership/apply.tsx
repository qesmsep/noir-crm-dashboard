import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Progress,
  Alert,
  AlertIcon,
  useToast,
  Card,
  CardBody,
  Heading,
  Icon,
  Container
} from '@chakra-ui/react';
import { FiCheckCircle, FiCircle } from 'react-icons/fi';
import QuestionnaireForm from '../../components/membership/QuestionnaireForm';
import AgreementForm from '../../components/membership/AgreementForm';
import PaymentForm from '../../components/membership/PaymentForm';
import ApplicationSuccess from '../../components/membership/ApplicationSuccess';

interface Application {
  id: string;
  email: string;
  status: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  questionnaire_completed_at?: string;
  agreement_completed_at?: string;
  payment_completed_at?: string;
}

const steps = [
  { id: 'questionnaire', title: 'Questionnaire', description: 'Tell us about yourself' },
  { id: 'agreement', title: 'Agreement', description: 'Review and sign the membership agreement' },
  { id: 'payment', title: 'Payment', description: 'Complete your membership payment' },
  { id: 'complete', title: 'Complete', description: 'Application submitted successfully' }
];

export default function MembershipApplication() {
  const router = useRouter();
  const toast = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [waitlistData, setWaitlistData] = useState<any>(null);
  const [applicationToken, setApplicationToken] = useState<string | null>(null);

  useEffect(() => {
    const { email, applicationId, token } = router.query;
    
    if (token) {
      // Handle token-based access
      setApplicationToken(token as string);
      loadApplicationByToken(token as string);
    } else if (email || applicationId) {
      // Handle direct access
      loadApplication(email as string, applicationId as string);
    } else {
      // No token or existing application - redirect to waitlist
      router.push('/waitlist');
      return;
    }
  }, [router.query]);

  const loadApplication = async (email?: string, applicationId?: string) => {
    try {
      const params = new URLSearchParams();
      if (email) params.append('email', email);
      if (applicationId) params.append('id', applicationId);

      const response = await fetch(`/api/membership/apply?${params}`);
      if (response.ok) {
        const data = await response.json();
        setApplication(data);
        
        // Determine current step based on application status
        if (data.payment_completed_at) {
          setCurrentStep(3);
        } else if (data.agreement_completed_at) {
          setCurrentStep(2);
        } else if (data.questionnaire_completed_at) {
          setCurrentStep(1);
        } else {
          setCurrentStep(0);
        }
      }
    } catch (err) {
      console.error('Error loading application:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadApplicationByToken = async (token: string) => {
    try {
      // First validate the token and get waitlist data
      const tokenResponse = await fetch(`/api/membership/validate-token?token=${token}`);
      
      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        if (errorData.expired) {
          setError('This application link has expired. Please contact us for a new link.');
        } else {
          setError('Invalid application link. Please check your link or contact us.');
        }
        setLoading(false);
        return;
      }

      const tokenData = await tokenResponse.json();
      setWaitlistData(tokenData.waitlist_data);

      // Check if there's already an application for this email
      try {
        const appResponse = await fetch(`/api/membership/apply?email=${tokenData.waitlist_data.email}`);
        if (appResponse.ok) {
          const existingApp = await appResponse.json();
          setApplication(existingApp);
          
          // Determine current step based on application status
          if (existingApp.payment_completed_at) {
            setCurrentStep(3);
          } else if (existingApp.agreement_completed_at) {
            setCurrentStep(2);
          } else if (existingApp.questionnaire_completed_at) {
            setCurrentStep(1);
          } else {
            setCurrentStep(0);
          }
        } else {
          // No existing application, start fresh
          setCurrentStep(0);
        }
      } catch (err) {
        // No existing application, start fresh
        setCurrentStep(0);
      }

    } catch (err) {
      console.error('Error loading application by token:', err);
      setError('Error loading application. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStepComplete = (stepIndex: number, data: any) => {
    if (stepIndex < steps.length - 1) {
      setCurrentStep(stepIndex + 1);
    }
    
    if (data) {
      setApplication(prev => ({ ...prev, ...data }));
    }

    // Show success message
    toast({
      title: 'Step completed!',
      description: `${steps[stepIndex].title} completed successfully.`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  const handleError = (message: string) => {
    setError(message);
    toast({
      title: 'Error',
      description: message,
      status: 'error',
      duration: 5000,
      isClosable: true,
    });
  };

  const getStepStatus = (stepIndex: number) => {
    if (stepIndex < currentStep) return 'completed';
    if (stepIndex === currentStep) return 'active';
    return 'upcoming';
  };

  const calculateProgress = () => {
    return (currentStep / (steps.length - 1)) * 100;
  };

  if (loading) {
    return (
      <Container maxW="4xl" py={8}>
        <VStack spacing={8}>
          <Text>Loading application...</Text>
        </VStack>
      </Container>
    );
  }

  return (
    <Container maxW="4xl" py={8}>
      <VStack spacing={8}>
        {/* Header */}
        <VStack spacing={4} textAlign="center">
          <Heading size="lg">Membership Application</Heading>
          <Text color="gray.600">
            Complete all steps to submit your membership application
          </Text>
        </VStack>

        {/* Progress Indicator */}
        <Box w="full">
          <Progress value={calculateProgress()} colorScheme="blue" size="lg" mb={4} />
          <HStack justify="space-between" w="full">
            {steps.map((step, index) => {
              const status = getStepStatus(index);
              return (
                <VStack key={step.id} spacing={2} align="center" flex={1}>
                  <Icon
                    as={status === 'completed' ? FiCheckCircle : FiCircle}
                    color={
                      status === 'completed' 
                        ? 'green.500' 
                        : status === 'active' 
                          ? 'blue.500' 
                          : 'gray.400'
                    }
                    boxSize={6}
                  />
                  <VStack spacing={0} align="center">
                    <Text
                      fontSize="sm"
                      fontWeight={status === 'active' ? 'bold' : 'normal'}
                      color={
                        status === 'completed' 
                          ? 'green.500' 
                          : status === 'active' 
                            ? 'blue.500' 
                            : 'gray.400'
                      }
                    >
                      {step.title}
                    </Text>
                    <Text fontSize="xs" color="gray.500" textAlign="center">
                      {step.description}
                    </Text>
                  </VStack>
                </VStack>
              );
            })}
          </HStack>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert status="error">
            <AlertIcon />
            {error}
          </Alert>
        )}

        {/* Step Content */}
        <Card w="full">
          <CardBody p={8}>
            {currentStep === 0 && (
              <QuestionnaireForm
                application={application}
                waitlistData={waitlistData}
                applicationToken={applicationToken}
                onComplete={(data) => handleStepComplete(0, data)}
                onError={handleError}
              />
            )}
            
            {currentStep === 1 && (
              <AgreementForm
                application={application}
                onComplete={(data) => handleStepComplete(1, data)}
                onError={handleError}
              />
            )}
            
            {currentStep === 2 && (
              <PaymentForm
                application={application}
                onComplete={(data) => handleStepComplete(2, data)}
                onError={handleError}
              />
            )}
            
            {currentStep === 3 && (
              <ApplicationSuccess application={application} />
            )}
          </CardBody>
        </Card>

        {/* Navigation */}
        {currentStep > 0 && currentStep < 3 && (
          <HStack w="full" justify="space-between">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(currentStep - 1)}
              isDisabled={currentStep === 0}
            >
              Previous Step
            </Button>
            <Box />
          </HStack>
        )}
      </VStack>
    </Container>
  );
}