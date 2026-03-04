import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Heading,
  Input,
  Textarea,
  Select,
  FormControl,
  FormLabel,
  Switch,
  IconButton,
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  useDisclosure,
  useToast,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Card,
  CardBody,
  Divider,
  Checkbox
} from '@chakra-ui/react';
import { Plus, Edit2, Trash2, GripVertical, Eye } from 'lucide-react';

interface Question {
  id?: string;
  question_text: string;
  question_type: 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'file';
  placeholder?: string;
  options?: { value: string; label: string }[];
  is_required: boolean;
  order_index: number;
}

interface Questionnaire {
  id?: string;
  title: string;
  description: string;
  type: 'waitlist' | 'membership' | 'custom';
  is_active: boolean;
  questionnaire_questions?: Question[];
}

export default function QuestionnaireBuilder() {
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState<Questionnaire | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);

  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    isOpen: isQuestionDrawerOpen,
    onOpen: onQuestionDrawerOpen,
    onClose: onQuestionDrawerClose
  } = useDisclosure();

  const toast = useToast();

  useEffect(() => {
    loadQuestionnaires();
  }, []);

  const loadQuestionnaires = async () => {
    try {
      const response = await fetch('/api/questionnaires');
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

  const handleCreateQuestionnaire = () => {
    setSelectedQuestionnaire({
      title: '',
      description: '',
      type: 'waitlist',
      is_active: true,
    });
    setQuestions([]);
    onOpen();
  };

  const handleEditQuestionnaire = async (questionnaire: Questionnaire) => {
    setSelectedQuestionnaire(questionnaire);

    // Load questions for this questionnaire
    if (questionnaire.id) {
      try {
        const response = await fetch(`/api/questionnaires/${questionnaire.id}/questions`);
        if (response.ok) {
          const data = await response.json();
          setQuestions(data);
        }
      } catch (error) {
        console.error('Failed to load questions:', error);
      }
    }

    onOpen();
  };

  const handleSaveQuestionnaire = async () => {
    if (!selectedQuestionnaire) return;

    try {
      const method = selectedQuestionnaire.id ? 'PUT' : 'POST';
      const url = selectedQuestionnaire.id
        ? `/api/questionnaires/${selectedQuestionnaire.id}`
        : '/api/questionnaires';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...selectedQuestionnaire,
          questions
        })
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: `Questionnaire ${selectedQuestionnaire.id ? 'updated' : 'created'}`,
          status: 'success',
          duration: 3000,
        });
        loadQuestionnaires();
        onClose();
      } else {
        throw new Error('Failed to save');
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

  const handleAddQuestion = () => {
    setEditingQuestion({
      question_text: '',
      question_type: 'text',
      placeholder: '',
      is_required: false,
      order_index: questions.length + 1
    });
    onQuestionDrawerOpen();
  };

  const handleEditQuestion = (question: Question) => {
    setEditingQuestion(question);
    onQuestionDrawerOpen();
  };

  const handleSaveQuestion = () => {
    if (!editingQuestion) return;

    const existingIndex = questions.findIndex(q => q.order_index === editingQuestion.order_index);

    if (existingIndex >= 0) {
      // Update existing
      const updated = [...questions];
      updated[existingIndex] = editingQuestion;
      setQuestions(updated);
    } else {
      // Add new
      setQuestions([...questions, editingQuestion]);
    }

    onQuestionDrawerClose();
    setEditingQuestion(null);
  };

  const handleDeleteQuestion = (orderIndex: number) => {
    setQuestions(questions.filter(q => q.order_index !== orderIndex));
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    const newQuestions = [...questions];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newQuestions.length) return;

    // Swap
    [newQuestions[index], newQuestions[targetIndex]] = [newQuestions[targetIndex], newQuestions[index]];

    // Update order_index
    newQuestions.forEach((q, i) => {
      q.order_index = i + 1;
    });

    setQuestions(newQuestions);
  };

  const getQuestionTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      text: '📝',
      email: '📧',
      phone: '📞',
      textarea: '📄',
      select: '📋',
      radio: '🔘',
      checkbox: '☑️',
      file: '📎'
    };
    return icons[type] || '❓';
  };

  if (loading) {
    return <Text>Loading...</Text>;
  }

  return (
    <VStack spacing={6} align="stretch">
      {/* Header */}
      <HStack justify="space-between">
        <VStack align="start" spacing={1}>
          <Heading size="md">Questionnaire Builder</Heading>
          <Text fontSize="sm" color="gray.600">
            Create beautiful, custom forms to replace Typeform
          </Text>
        </VStack>
        <Button
          leftIcon={<Plus size={16} />}
          bg="#A59480"
          color="white"
          _hover={{ bg: '#8F7F6B' }}
          onClick={handleCreateQuestionnaire}
          boxShadow="0 2px 4px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.1)"
        >
          Create Form
        </Button>
      </HStack>

      {/* Questionnaires List */}
      <Card>
        <CardBody>
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Form Name</Th>
                <Th>Type</Th>
                <Th>Questions</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {questionnaires.map((q) => (
                <Tr key={q.id}>
                  <Td>
                    <VStack align="start" spacing={1}>
                      <Text fontWeight="bold">{q.title}</Text>
                      <Text fontSize="sm" color="gray.500">{q.description}</Text>
                    </VStack>
                  </Td>
                  <Td>
                    <Badge colorScheme={q.type === 'waitlist' ? 'purple' : 'blue'}>
                      {q.type}
                    </Badge>
                  </Td>
                  <Td>
                    <Text>{q.questionnaire_questions?.length || 0} questions</Text>
                  </Td>
                  <Td>
                    <Badge colorScheme={q.is_active ? 'green' : 'gray'}>
                      {q.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </Td>
                  <Td>
                    <HStack spacing={2}>
                      <IconButton
                        size="sm"
                        icon={<Edit2 size={16} />}
                        aria-label="Edit"
                        onClick={() => handleEditQuestionnaire(q)}
                      />
                      <IconButton
                        size="sm"
                        icon={<Eye size={16} />}
                        aria-label="Preview"
                        colorScheme="blue"
                      />
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>

          {questionnaires.length === 0 && (
            <Box py={8} textAlign="center">
              <Text color="gray.500">No forms yet. Create your first one!</Text>
            </Box>
          )}
        </CardBody>
      </Card>

      {/* Questionnaire Editor Drawer */}
      <Drawer isOpen={isOpen} onClose={onClose} size="lg" placement="right">
        <DrawerOverlay />
        <DrawerContent bg="#ECEDE8" maxW="50vw" w="100%">
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px" color="#353535">
            {selectedQuestionnaire?.id ? 'Edit' : 'Create'} Questionnaire
          </DrawerHeader>

          <DrawerBody>
            <VStack spacing={6} align="stretch" pt={4}>
              {/* Basic Info */}
              <Card>
                <CardBody>
                  <VStack spacing={4} align="stretch">
                    <FormControl isRequired>
                      <FormLabel>Form Title</FormLabel>
                      <Input
                        value={selectedQuestionnaire?.title || ''}
                        onChange={(e) =>
                          setSelectedQuestionnaire({
                            ...selectedQuestionnaire!,
                            title: e.target.value
                          })
                        }
                        placeholder="e.g., Waitlist Application"
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel>Description</FormLabel>
                      <Textarea
                        value={selectedQuestionnaire?.description || ''}
                        onChange={(e) =>
                          setSelectedQuestionnaire({
                            ...selectedQuestionnaire!,
                            description: e.target.value
                          })
                        }
                        placeholder="Optional description"
                        rows={2}
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel>Form Type</FormLabel>
                      <Select
                        value={selectedQuestionnaire?.type || 'waitlist'}
                        onChange={(e) =>
                          setSelectedQuestionnaire({
                            ...selectedQuestionnaire!,
                            type: e.target.value as any
                          })
                        }
                      >
                        <option value="waitlist">Waitlist</option>
                        <option value="membership">Membership Application</option>
                        <option value="custom">Custom</option>
                      </Select>
                    </FormControl>

                    <FormControl display="flex" alignItems="center">
                      <FormLabel mb="0">Active</FormLabel>
                      <Switch
                        isChecked={selectedQuestionnaire?.is_active}
                        onChange={(e) =>
                          setSelectedQuestionnaire({
                            ...selectedQuestionnaire!,
                            is_active: e.target.checked
                          })
                        }
                        colorScheme="green"
                      />
                    </FormControl>
                  </VStack>
                </CardBody>
              </Card>

              <Divider />

              {/* Questions Section */}
              <Box>
                <HStack justify="space-between" mb={4}>
                  <Heading size="sm">Questions ({questions.length})</Heading>
                  <Button
                    size="sm"
                    leftIcon={<Plus size={14} />}
                    onClick={handleAddQuestion}
                    colorScheme="blue"
                  >
                    Add Question
                  </Button>
                </HStack>

                <VStack spacing={3} align="stretch">
                  {questions.sort((a, b) => a.order_index - b.order_index).map((question, index) => (
                    <Card key={question.order_index}>
                      <CardBody>
                        <HStack justify="space-between" align="start">
                          <HStack spacing={3} flex={1}>
                            <Text fontSize="lg">{getQuestionTypeIcon(question.question_type)}</Text>
                            <VStack align="start" spacing={1} flex={1}>
                              <HStack>
                                <Text fontWeight="bold">#{question.order_index}</Text>
                                <Text>{question.question_text}</Text>
                                {question.is_required && (
                                  <Badge colorScheme="red" size="sm">Required</Badge>
                                )}
                              </HStack>
                              <Text fontSize="sm" color="gray.500">
                                Type: {question.question_type}
                              </Text>
                            </VStack>
                          </HStack>

                          <HStack spacing={1}>
                            <IconButton
                              size="xs"
                              icon={<GripVertical size={14} />}
                              aria-label="Move up"
                              onClick={() => moveQuestion(index, 'up')}
                              isDisabled={index === 0}
                            />
                            <IconButton
                              size="xs"
                              icon={<GripVertical size={14} />}
                              aria-label="Move down"
                              onClick={() => moveQuestion(index, 'down')}
                              isDisabled={index === questions.length - 1}
                            />
                            <IconButton
                              size="xs"
                              icon={<Edit2 size={14} />}
                              aria-label="Edit"
                              onClick={() => handleEditQuestion(question)}
                            />
                            <IconButton
                              size="xs"
                              icon={<Trash2 size={14} />}
                              aria-label="Delete"
                              colorScheme="red"
                              onClick={() => handleDeleteQuestion(question.order_index)}
                            />
                          </HStack>
                        </HStack>
                      </CardBody>
                    </Card>
                  ))}

                  {questions.length === 0 && (
                    <Box py={6} textAlign="center" borderRadius="md" bg="gray.50">
                      <Text color="gray.500">No questions yet. Add your first one!</Text>
                    </Box>
                  )}
                </VStack>
              </Box>
            </VStack>
          </DrawerBody>

          <DrawerFooter borderTopWidth="1px">
            <Button variant="outline" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button
              bg="#A59480"
              color="white"
              _hover={{ bg: '#8F7F6B' }}
              onClick={handleSaveQuestionnaire}
              boxShadow="0 2px 4px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.1)"
            >
              Save Questionnaire
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Question Editor Drawer */}
      <Drawer isOpen={isQuestionDrawerOpen} onClose={onQuestionDrawerClose} size="md" placement="right">
        <DrawerOverlay />
        <DrawerContent bg="#ECEDE8">
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px" color="#353535">
            {editingQuestion?.id ? 'Edit' : 'Add'} Question
          </DrawerHeader>

          <DrawerBody>
            <VStack spacing={4} align="stretch" pt={4}>
              <FormControl isRequired>
                <FormLabel>Question Text</FormLabel>
                <Input
                  value={editingQuestion?.question_text || ''}
                  onChange={(e) =>
                    setEditingQuestion({
                      ...editingQuestion!,
                      question_text: e.target.value
                    })
                  }
                  placeholder="e.g., What is your email?"
                />
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Question Type</FormLabel>
                <Select
                  value={editingQuestion?.question_type || 'text'}
                  onChange={(e) =>
                    setEditingQuestion({
                      ...editingQuestion!,
                      question_type: e.target.value as any
                    })
                  }
                >
                  <option value="text">Text</option>
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="textarea">Long Text</option>
                  <option value="select">Dropdown</option>
                  <option value="radio">Multiple Choice</option>
                  <option value="checkbox">Checkboxes</option>
                  <option value="file">File Upload</option>
                </Select>
              </FormControl>

              <FormControl>
                <FormLabel>Placeholder</FormLabel>
                <Input
                  value={editingQuestion?.placeholder || ''}
                  onChange={(e) =>
                    setEditingQuestion({
                      ...editingQuestion!,
                      placeholder: e.target.value
                    })
                  }
                  placeholder="e.g., Enter your email"
                />
              </FormControl>

              {(editingQuestion?.question_type === 'select' ||
                editingQuestion?.question_type === 'radio' ||
                editingQuestion?.question_type === 'checkbox') && (
                <FormControl>
                  <FormLabel>Options (one per line)</FormLabel>
                  <Textarea
                    placeholder="Option 1&#10;Option 2&#10;Option 3"
                    rows={5}
                    onChange={(e) => {
                      const lines = e.target.value.split('\n').filter(l => l.trim());
                      const options = lines.map((line, i) => ({
                        value: `option${i + 1}`,
                        label: line.trim()
                      }));
                      setEditingQuestion({
                        ...editingQuestion!,
                        options
                      });
                    }}
                    value={editingQuestion?.options?.map(o => o.label).join('\n') || ''}
                  />
                </FormControl>
              )}

              <FormControl display="flex" alignItems="center">
                <Checkbox
                  isChecked={editingQuestion?.is_required}
                  onChange={(e) =>
                    setEditingQuestion({
                      ...editingQuestion!,
                      is_required: e.target.checked
                    })
                  }
                  colorScheme="red"
                >
                  <Text fontWeight="medium">Required field</Text>
                </Checkbox>
              </FormControl>
            </VStack>
          </DrawerBody>

          <DrawerFooter borderTopWidth="1px">
            <Button variant="outline" mr={3} onClick={onQuestionDrawerClose}>
              Cancel
            </Button>
            <Button
              bg="#A59480"
              color="white"
              _hover={{ bg: '#8F7F6B' }}
              onClick={handleSaveQuestion}
              boxShadow="0 2px 4px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.1)"
            >
              Save Question
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </VStack>
  );
}
