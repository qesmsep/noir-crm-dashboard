import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Input,
  Textarea,
  Select,
  Radio,
  RadioGroup,
  Checkbox,
  CheckboxGroup,
  Progress,
  FormControl,
  FormLabel,
  FormErrorMessage,
  useToast,
  Card,
  CardBody,
  Icon,
  Image
} from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Upload, Check } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const MotionBox = motion(Box);

interface Question {
  id: string;
  question_text: string;
  question_type: 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'file';
  placeholder?: string;
  options?: { value: string; label: string }[];
  is_required: boolean;
  order_index: number;
}

interface AnimatedQuestionnaireProps {
  questionnaireId: string;
  waitlistId?: string;
  onComplete: (responses: Record<string, any>) => void;
  prefillData?: Record<string, string>;
}

export default function AnimatedQuestionnaire({
  questionnaireId,
  waitlistId,
  onComplete,
  prefillData = {}
}: AnimatedQuestionnaireProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, any>>(prefillData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [uploadingFile, setUploadingFile] = useState(false);

  const toast = useToast();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    loadQuestions();
  }, [questionnaireId]);

  const loadQuestions = async () => {
    try {
      const response = await fetch(`/api/questionnaires/${questionnaireId}/questions`);
      if (response.ok) {
        const data = await response.json();
        setQuestions(data.sort((a: Question, b: Question) => a.order_index - b.order_index));
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load questionnaire',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const isFirstQuestion = currentQuestionIndex === 0;
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  const validateCurrentQuestion = (): boolean => {
    if (!currentQuestion) return true;

    const value = responses[currentQuestion.id];
    const newErrors = { ...errors };

    // Check if required field is empty
    if (currentQuestion.is_required && (!value || (Array.isArray(value) && value.length === 0))) {
      newErrors[currentQuestion.id] = 'This field is required';
      setErrors(newErrors);
      return false;
    }

    // Validate email
    if (currentQuestion.question_type === 'email' && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        newErrors[currentQuestion.id] = 'Please enter a valid email';
        setErrors(newErrors);
        return false;
      }
    }

    // Validate phone
    if (currentQuestion.question_type === 'phone' && value) {
      const phoneRegex = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
      if (!phoneRegex.test(value.replace(/\s/g, ''))) {
        newErrors[currentQuestion.id] = 'Please enter a valid phone number';
        setErrors(newErrors);
        return false;
      }
    }

    // Clear error if valid
    delete newErrors[currentQuestion.id];
    setErrors(newErrors);
    return true;
  };

  const handleNext = () => {
    if (!validateCurrentQuestion()) return;

    if (isLastQuestion) {
      handleSubmit();
    } else {
      setDirection('forward');
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (!isFirstQuestion) {
      setDirection('backward');
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentQuestion) return;

    setUploadingFile(true);

    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${waitlistId || 'temp'}-${currentQuestion.id}.${fileExt}`;
      const filePath = `questionnaire-uploads/${fileName}`;

      const { data, error } = await supabase.storage
        .from('member-photos')
        .upload(filePath, file, { upsert: true });

      if (error) throw error;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('member-photos')
        .getPublicUrl(filePath);

      setResponses({
        ...responses,
        [currentQuestion.id]: urlData.publicUrl
      });

      toast({
        title: 'Success',
        description: 'File uploaded successfully',
        status: 'success',
        duration: 2000,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to upload file',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSubmit = async () => {
    // Validate all questions
    let isValid = true;
    const newErrors: Record<string, string> = {};

    questions.forEach(question => {
      const value = responses[question.id];
      if (question.is_required && !value) {
        newErrors[question.id] = 'This field is required';
        isValid = false;
      }
    });

    if (!isValid) {
      setErrors(newErrors);
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    onComplete(responses);
  };

  const renderQuestionInput = () => {
    if (!currentQuestion) return null;

    const value = responses[currentQuestion.id] || '';
    const hasError = !!errors[currentQuestion.id];

    const commonProps = {
      value,
      onChange: (e: any) => {
        setResponses({
          ...responses,
          [currentQuestion.id]: e.target.value
        });
        // Clear error on change
        if (errors[currentQuestion.id]) {
          const newErrors = { ...errors };
          delete newErrors[currentQuestion.id];
          setErrors(newErrors);
        }
      },
      placeholder: currentQuestion.placeholder,
      isInvalid: hasError,
      size: 'lg',
      borderRadius: 'md',
      bg: 'white',
      borderWidth: '2px',
      borderColor: hasError ? 'red.400' : 'gray.300',
      _focus: {
        borderColor: '#A59480',
        boxShadow: '0 0 0 1px #A59480'
      },
      minH: '48px' // Touch-friendly
    };

    switch (currentQuestion.question_type) {
      case 'text':
      case 'email':
      case 'phone':
        return <Input {...commonProps} type={currentQuestion.question_type} />;

      case 'textarea':
        return <Textarea {...commonProps} rows={5} />;

      case 'select':
        return (
          <Select {...commonProps}>
            <option value="">Select an option...</option>
            {currentQuestion.options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        );

      case 'radio':
        return (
          <RadioGroup
            value={value}
            onChange={(val) => setResponses({ ...responses, [currentQuestion.id]: val })}
          >
            <VStack spacing={3} align="stretch">
              {currentQuestion.options?.map(option => (
                <Box
                  key={option.value}
                  p={4}
                  borderRadius="md"
                  borderWidth="2px"
                  borderColor={value === option.value ? '#A59480' : 'gray.300'}
                  bg={value === option.value ? '#A5948010' : 'white'}
                  cursor="pointer"
                  transition="all 0.2s"
                  _hover={{ borderColor: '#A59480' }}
                  minH="48px"
                  display="flex"
                  alignItems="center"
                >
                  <Radio value={option.value} colorScheme="orange" size="lg">
                    <Text fontSize="md" fontWeight="medium">{option.label}</Text>
                  </Radio>
                </Box>
              ))}
            </VStack>
          </RadioGroup>
        );

      case 'checkbox':
        return (
          <CheckboxGroup
            value={Array.isArray(value) ? value : []}
            onChange={(vals) => setResponses({ ...responses, [currentQuestion.id]: vals })}
          >
            <VStack spacing={3} align="stretch">
              {currentQuestion.options?.map(option => (
                <Box
                  key={option.value}
                  p={4}
                  borderRadius="md"
                  borderWidth="2px"
                  borderColor={(Array.isArray(value) && value.includes(option.value)) ? '#A59480' : 'gray.300'}
                  bg={(Array.isArray(value) && value.includes(option.value)) ? '#A5948010' : 'white'}
                  cursor="pointer"
                  transition="all 0.2s"
                  _hover={{ borderColor: '#A59480' }}
                  minH="48px"
                  display="flex"
                  alignItems="center"
                >
                  <Checkbox value={option.value} colorScheme="orange" size="lg">
                    <Text fontSize="md" fontWeight="medium">{option.label}</Text>
                  </Checkbox>
                </Box>
              ))}
            </VStack>
          </CheckboxGroup>
        );

      case 'file':
        return (
          <VStack spacing={4} align="stretch">
            <Button
              as="label"
              htmlFor="file-upload"
              size="lg"
              leftIcon={<Icon as={Upload} />}
              bg="white"
              borderWidth="2px"
              borderColor="gray.300"
              borderStyle="dashed"
              _hover={{ borderColor: '#A59480' }}
              cursor="pointer"
              h="120px"
              isLoading={uploadingFile}
            >
              <VStack spacing={2}>
                <Text>Click to upload</Text>
                <Text fontSize="sm" color="gray.500">or drag and drop</Text>
              </VStack>
            </Button>
            <Input
              id="file-upload"
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              display="none"
            />
            {value && (
              <Box position="relative" borderRadius="md" overflow="hidden">
                <Image src={value} alt="Uploaded file" maxH="200px" objectFit="cover" />
                <Box
                  position="absolute"
                  top={2}
                  right={2}
                  bg="green.500"
                  color="white"
                  borderRadius="full"
                  p={2}
                >
                  <Icon as={Check} />
                </Box>
              </Box>
            )}
          </VStack>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Box minH="400px" display="flex" alignItems="center" justifyContent="center">
        <Text>Loading questionnaire...</Text>
      </Box>
    );
  }

  if (questions.length === 0) {
    return (
      <Box minH="400px" display="flex" alignItems="center" justifyContent="center">
        <Text>No questions available</Text>
      </Box>
    );
  }

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

  return (
    <Box w="100%" maxW="600px" mx="auto" px={4} py={8}>
      {/* Progress Bar */}
      <VStack spacing={2} mb={8} align="stretch">
        <HStack justify="space-between">
          <Text fontSize="sm" fontWeight="medium" color="gray.600">
            Question {currentQuestionIndex + 1} of {questions.length}
          </Text>
          <Text fontSize="sm" fontWeight="bold" color="#A59480">
            {Math.round(progress)}%
          </Text>
        </HStack>
        <Progress
          value={progress}
          borderRadius="full"
          bg="gray.200"
          sx={{
            '& > div': {
              background: 'linear-gradient(90deg, #A59480 0%, #8F7F6B 100%)'
            }
          }}
          h="8px"
        />
      </VStack>

      {/* Animated Question Card */}
      <AnimatePresence mode="wait" custom={direction}>
        <MotionBox
          key={currentQuestionIndex}
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
                {/* Question Text */}
                <FormControl isInvalid={!!errors[currentQuestion?.id]}>
                  <FormLabel
                    fontSize="2xl"
                    fontWeight="bold"
                    color="#353535"
                    mb={4}
                  >
                    {currentQuestion?.question_text}
                    {currentQuestion?.is_required && (
                      <Text as="span" color="red.500" ml={1}>*</Text>
                    )}
                  </FormLabel>

                  {/* Input */}
                  {renderQuestionInput()}

                  <FormErrorMessage mt={2} fontSize="sm">
                    {errors[currentQuestion?.id]}
                  </FormErrorMessage>
                </FormControl>

                {/* Navigation Buttons */}
                <HStack spacing={3} pt={4}>
                  <Button
                    leftIcon={<Icon as={ArrowLeft} />}
                    onClick={handleBack}
                    isDisabled={isFirstQuestion}
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
                    rightIcon={<Icon as={isLastQuestion ? Check : ArrowRight} />}
                    onClick={handleNext}
                    bg="#A59480"
                    color="white"
                    flex={2}
                    size="lg"
                    minH="56px"
                    _hover={{ bg: '#8F7F6B' }}
                    boxShadow="0 2px 4px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.1)"
                  >
                    {isLastQuestion ? 'Submit' : 'Next'}
                  </Button>
                </HStack>
              </VStack>
            </CardBody>
          </Card>
        </MotionBox>
      </AnimatePresence>
    </Box>
  );
}
