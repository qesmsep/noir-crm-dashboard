import React, { useState, useEffect } from 'react';
import {
  VStack,
  HStack,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Select,
  RadioGroup,
  Radio,
  CheckboxGroup,
  Checkbox,
  Button,
  Text,
  Heading,
  Alert,
  AlertIcon,
  FormErrorMessage,
  Box,
  Stack
} from '@chakra-ui/react';

interface Question {
  id: string;
  question_text: string;
  question_type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'email' | 'phone' | 'number' | 'date';
  options?: { value: string; label: string }[];
  is_required: boolean;
  order_index: number;
}

interface Questionnaire {
  id: string;
  title: string;
  description: string;
  questionnaire_questions: Question[];
}

interface Application {
  id?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
}

interface Props {
  application: Application | null;
  onComplete: (data: any) => void;
  onError: (message: string) => void;
}

export default function QuestionnaireForm({ application, onComplete, onError }: Props) {
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [formData, setFormData] = useState({
    email: application?.email || '',
    first_name: application?.first_name || '',
    last_name: application?.last_name || '',
    phone: application?.phone || ''
  });
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadQuestionnaire();
  }, []);

  const loadQuestionnaire = async () => {
    try {
      const response = await fetch('/api/membership/questionnaires');
      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          const activeQuestionnaire = data[0]; // Get the first active questionnaire
          setQuestionnaire(activeQuestionnaire);
        } else {
          onError('No active questionnaire found');
        }
      } else {
        onError('Failed to load questionnaire');
      }
    } catch (error) {
      onError('Error loading questionnaire');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleResponseChange = (questionId: string, value: any) => {
    setResponses(prev => ({ ...prev, [questionId]: value }));
    if (errors[questionId]) {
      setErrors(prev => ({ ...prev, [questionId]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Validate required basic info
    if (!formData.email) newErrors.email = 'Email is required';
    if (!formData.first_name) newErrors.first_name = 'First name is required';
    if (!formData.last_name) newErrors.last_name = 'Last name is required';

    // Email validation
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Validate questionnaire responses
    if (questionnaire) {
      questionnaire.questionnaire_questions.forEach(question => {
        if (question.is_required && !responses[question.id]) {
          newErrors[question.id] = 'This field is required';
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSubmitting(true);

    try {
      const submitData = {
        ...formData,
        questionnaire_id: questionnaire?.id,
        responses: Object.entries(responses).map(([question_id, value]) => ({
          question_id,
          response_text: typeof value === 'string' ? value : null,
          response_data: typeof value !== 'string' ? value : null
        })),
        step: 'questionnaire'
      };

      const response = await fetch('/api/membership/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      });

      if (response.ok) {
        const data = await response.json();
        onComplete(data);
      } else {
        const errorData = await response.json();
        onError(errorData.error || 'Failed to submit questionnaire');
      }
    } catch (error) {
      onError('Error submitting questionnaire');
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestion = (question: Question) => {
    const value = responses[question.id] || '';

    switch (question.question_type) {
      case 'text':
      case 'email':
      case 'phone':
        return (
          <Input
            type={question.question_type === 'email' ? 'email' : question.question_type === 'phone' ? 'tel' : 'text'}
            value={value}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            placeholder={`Enter ${question.question_text.toLowerCase()}`}
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            value={value}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            placeholder={`Enter ${question.question_text.toLowerCase()}`}
          />
        );

      case 'date':
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
          />
        );

      case 'textarea':
        return (
          <Textarea
            value={value}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            placeholder={`Enter ${question.question_text.toLowerCase()}`}
            rows={4}
          />
        );

      case 'select':
        return (
          <Select
            value={value}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            placeholder="Select an option"
          >
            {question.options?.map((option, index) => (
              <option key={index} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        );

      case 'radio':
        return (
          <RadioGroup
            value={value}
            onChange={(val) => handleResponseChange(question.id, val)}
          >
            <Stack spacing={2}>
              {question.options?.map((option, index) => (
                <Radio key={index} value={option.value}>
                  {option.label}
                </Radio>
              ))}
            </Stack>
          </RadioGroup>
        );

      case 'checkbox':
        return (
          <CheckboxGroup
            value={value || []}
            onChange={(val) => handleResponseChange(question.id, val)}
          >
            <Stack spacing={2}>
              {question.options?.map((option, index) => (
                <Checkbox key={index} value={option.value}>
                  {option.label}
                </Checkbox>
              ))}
            </Stack>
          </CheckboxGroup>
        );

      default:
        return <Text color="red.500">Unsupported question type</Text>;
    }
  };

  if (loading) {
    return <Text>Loading questionnaire...</Text>;
  }

  if (!questionnaire) {
    return (
      <Alert status="error">
        <AlertIcon />
        No questionnaire available
      </Alert>
    );
  }

  return (
    <VStack spacing={6} align="stretch">
      <VStack spacing={2} align="start">
        <Heading size="md">{questionnaire.title}</Heading>
        {questionnaire.description && (
          <Text color="gray.600">{questionnaire.description}</Text>
        )}
      </VStack>

      {/* Basic Information */}
      <Box>
        <Heading size="sm" mb={4}>Basic Information</Heading>
        <VStack spacing={4}>
          <HStack spacing={4} w="full">
            <FormControl isInvalid={!!errors.first_name} isRequired>
              <FormLabel>First Name</FormLabel>
              <Input
                value={formData.first_name}
                onChange={(e) => handleInputChange('first_name', e.target.value)}
                placeholder="Enter your first name"
              />
              <FormErrorMessage>{errors.first_name}</FormErrorMessage>
            </FormControl>

            <FormControl isInvalid={!!errors.last_name} isRequired>
              <FormLabel>Last Name</FormLabel>
              <Input
                value={formData.last_name}
                onChange={(e) => handleInputChange('last_name', e.target.value)}
                placeholder="Enter your last name"
              />
              <FormErrorMessage>{errors.last_name}</FormErrorMessage>
            </FormControl>
          </HStack>

          <FormControl isInvalid={!!errors.email} isRequired>
            <FormLabel>Email Address</FormLabel>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="Enter your email address"
            />
            <FormErrorMessage>{errors.email}</FormErrorMessage>
          </FormControl>

          <FormControl isInvalid={!!errors.phone}>
            <FormLabel>Phone Number</FormLabel>
            <Input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              placeholder="Enter your phone number"
            />
            <FormErrorMessage>{errors.phone}</FormErrorMessage>
          </FormControl>
        </VStack>
      </Box>

      {/* Questionnaire Questions */}
      <Box>
        <Heading size="sm" mb={4}>Questionnaire</Heading>
        <VStack spacing={6}>
          {questionnaire.questionnaire_questions
            .sort((a, b) => a.order_index - b.order_index)
            .map((question) => (
              <FormControl
                key={question.id}
                isInvalid={!!errors[question.id]}
                isRequired={question.is_required}
              >
                <FormLabel>{question.question_text}</FormLabel>
                {renderQuestion(question)}
                <FormErrorMessage>{errors[question.id]}</FormErrorMessage>
              </FormControl>
            ))}
        </VStack>
      </Box>

      <Button
        colorScheme="blue"
        size="lg"
        onClick={handleSubmit}
        isLoading={submitting}
        loadingText="Submitting..."
      >
        Complete Questionnaire
      </Button>
    </VStack>
  );
}