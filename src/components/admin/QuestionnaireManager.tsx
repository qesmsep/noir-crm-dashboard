import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  useDisclosure,
  useToast,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Select,
  Checkbox,
  IconButton,
  Icon
} from '@chakra-ui/react';
import { FiPlus, FiEdit, FiTrash2 } from 'react-icons/fi';

interface Question {
  id?: string;
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
  is_active: boolean;
  questionnaire_questions: Question[];
}

export default function QuestionnaireManager() {
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingQuestionnaire, setEditingQuestionnaire] = useState<Questionnaire | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  useEffect(() => {
    loadQuestionnaires();
  }, []);

  const loadQuestionnaires = async () => {
    try {
      const response = await fetch('/api/membership/questionnaires?includeInactive=true');
      if (response.ok) {
        const data = await response.json();
        setQuestionnaires(data);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load questionnaires',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingQuestionnaire(null);
    setQuestions([]);
    onOpen();
  };

  const handleEdit = (questionnaire: Questionnaire) => {
    setEditingQuestionnaire(questionnaire);
    setQuestions([...questionnaire.questionnaire_questions]);
    onOpen();
  };

  const addQuestion = () => {
    const newQuestion: Question = {
      question_text: '',
      question_type: 'text',
      is_required: false,
      order_index: questions.length
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const updatedQuestions = [...questions];
    updatedQuestions[index] = { ...updatedQuestions[index], [field]: value };
    setQuestions(updatedQuestions);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!editingQuestionnaire?.title || questions.length === 0) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    try {
      const method = editingQuestionnaire ? 'PUT' : 'POST';
      const response = await fetch('/api/membership/questionnaires', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingQuestionnaire?.id,
          title: editingQuestionnaire?.title || 'New Questionnaire',
          description: editingQuestionnaire?.description || '',
          is_active: editingQuestionnaire?.is_active ?? true,
          questions: questions.map((q, index) => ({ ...q, order_index: index }))
        })
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Questionnaire saved successfully',
          status: 'success',
          duration: 3000,
        });
        onClose();
        loadQuestionnaires();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save questionnaire',
        status: 'error',
        duration: 3000,
      });
    }
  };

  if (loading) {
    return <Text>Loading questionnaires...</Text>;
  }

  return (
    <VStack spacing={6} align="stretch">
      <HStack justify="space-between">
        <VStack align="start" spacing={1}>
          <Heading size="md">Questionnaires</Heading>
          <Text fontSize="sm" color="gray.600">
            Manage membership application questionnaires
          </Text>
        </VStack>
        <Button leftIcon={<Icon as={FiPlus} />} onClick={handleCreate}>
          Create Questionnaire
        </Button>
      </HStack>

      <Table variant="simple">
        <Thead>
          <Tr>
            <Th>Title</Th>
            <Th>Questions</Th>
            <Th>Status</Th>
            <Th>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {questionnaires.map((questionnaire) => (
            <Tr key={questionnaire.id}>
              <Td>
                <VStack align="start" spacing={1}>
                  <Text fontWeight="bold">{questionnaire.title}</Text>
                  {questionnaire.description && (
                    <Text fontSize="sm" color="gray.500">{questionnaire.description}</Text>
                  )}
                </VStack>
              </Td>
              <Td>{questionnaire.questionnaire_questions.length} questions</Td>
              <Td>
                <Badge colorScheme={questionnaire.is_active ? 'green' : 'gray'}>
                  {questionnaire.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </Td>
              <Td>
                <IconButton
                  size="sm"
                  icon={<FiEdit />}
                  onClick={() => handleEdit(questionnaire)}
                  aria-label="Edit questionnaire"
                  colorScheme="blue"
                />
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      {/* Edit Drawer */}
      <Drawer isOpen={isOpen} onClose={onClose} size="xl">
        <DrawerOverlay />
        <DrawerContent bg="#ECEDE8" color="#353535">
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px" color="#353535">
            {editingQuestionnaire ? 'Edit Questionnaire' : 'Create Questionnaire'}
          </DrawerHeader>
          <DrawerBody>
            <VStack spacing={4} align="stretch" pt={4}>
              <FormControl>
                <FormLabel color="#353535">Title</FormLabel>
                <Input
                  value={editingQuestionnaire?.title || ''}
                  onChange={(e) => setEditingQuestionnaire(prev => ({ ...prev!, title: e.target.value }))}
                  placeholder="Enter questionnaire title"
                  bg="white"
                  borderColor="gray.300"
                  _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px #3182ce" }}
                />
              </FormControl>

              <FormControl>
                <FormLabel color="#353535">Description</FormLabel>
                <Textarea
                  value={editingQuestionnaire?.description || ''}
                  onChange={(e) => setEditingQuestionnaire(prev => ({ ...prev!, description: e.target.value }))}
                  placeholder="Enter questionnaire description"
                  bg="white"
                  borderColor="gray.300"
                  _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px #3182ce" }}
                />
              </FormControl>

              <FormControl>
                <Checkbox
                  isChecked={editingQuestionnaire?.is_active ?? true}
                  onChange={(e) => setEditingQuestionnaire(prev => ({ ...prev!, is_active: e.target.checked }))}
                  color="#353535"
                >
                  Active
                </Checkbox>
              </FormControl>

              <Box>
                <HStack justify="space-between" mb={4}>
                  <Text fontWeight="bold" color="#353535">Questions</Text>
                  <Button size="sm" onClick={addQuestion}>
                    Add Question
                  </Button>
                </HStack>

                <VStack spacing={4} align="stretch">
                  {questions.map((question, index) => (
                    <Box key={index} p={4} border="1px" borderColor="gray.300" borderRadius="md" bg="white">
                      <VStack spacing={3} align="stretch">
                        <HStack justify="space-between">
                          <Text fontWeight="bold" color="#353535">Question {index + 1}</Text>
                          <IconButton
                            size="sm"
                            icon={<Icon as={FiTrash2} />}
                            onClick={() => removeQuestion(index)}
                            aria-label="Remove question"
                            colorScheme="red"
                            variant="ghost"
                          />
                        </HStack>

                        <FormControl>
                          <FormLabel color="#353535">Question Text</FormLabel>
                          <Input
                            value={question.question_text}
                            onChange={(e) => updateQuestion(index, 'question_text', e.target.value)}
                            placeholder="Enter question text"
                            bg="white"
                            borderColor="gray.300"
                            _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px #3182ce" }}
                          />
                        </FormControl>

                        <HStack spacing={4}>
                          <FormControl>
                            <FormLabel color="#353535">Type</FormLabel>
                            <Select
                              value={question.question_type}
                              onChange={(e) => updateQuestion(index, 'question_type', e.target.value)}
                              bg="white"
                              borderColor="gray.300"
                              _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px #3182ce" }}
                            >
                              <option value="text">Text</option>
                              <option value="textarea">Text Area</option>
                              <option value="email">Email</option>
                              <option value="phone">Phone</option>
                              <option value="number">Number</option>
                              <option value="date">Date</option>
                              <option value="select">Select</option>
                              <option value="radio">Radio</option>
                              <option value="checkbox">Checkbox</option>
                            </Select>
                          </FormControl>

                          <FormControl>
                            <Checkbox
                              isChecked={question.is_required}
                              onChange={(e) => updateQuestion(index, 'is_required', e.target.checked)}
                              color="#353535"
                            >
                              Required
                            </Checkbox>
                          </FormControl>
                        </HStack>
                      </VStack>
                    </Box>
                  ))}
                </VStack>
              </Box>
            </VStack>
          </DrawerBody>
          <DrawerFooter borderTopWidth="1px">
            <HStack spacing={3}>
              <Button onClick={onClose} variant="outline">
                Cancel
              </Button>
              <Button colorScheme="blue" onClick={handleSave}>
                Save Questionnaire
              </Button>
            </HStack>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </VStack>
  );
} 