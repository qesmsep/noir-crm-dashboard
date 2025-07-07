import React from 'react';
import { Box, VStack, Button, Text, Input, Select, Textarea, HStack, IconButton, FormControl, FormLabel } from '@chakra-ui/react';
import { DeleteIcon, EditIcon } from '@chakra-ui/icons';

const QUESTION_TYPES = [
  { value: 'text', label: 'Short Text' },
  { value: 'textarea', label: 'Paragraph' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'checkbox', label: 'Checkboxes' },
  { value: 'date', label: 'Date' },
  { value: 'file', label: 'File Upload' },
  { value: 'photo', label: 'Photo Upload' },
  { value: 'phone', label: 'Phone Number' },
  { value: 'signature', label: 'E-Signature' },
];

function defaultQuestion() {
  return {
    question_text: '',
    question_type: 'text',
    options: [],
    is_required: false,
  };
}

interface QuestionEditorProps {
  questions: any[];
  setQuestions: (qs: any[]) => void;
}

const QuestionEditor: React.FC<QuestionEditorProps> = ({ questions, setQuestions }) => {
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [editForm, setEditForm] = React.useState<any>(defaultQuestion());
  const [showAdd, setShowAdd] = React.useState(false);

  const handleAdd = () => {
    setEditForm(defaultQuestion());
    setEditingIndex(null);
    setShowAdd(true);
  };

  const handleEdit = (idx: number) => {
    setEditForm(questions[idx]);
    setEditingIndex(idx);
    setShowAdd(true);
  };

  const handleRemove = (idx: number) => {
    console.log('Removing question at index:', idx);
    console.log('Questions before removal:', questions);
    const newQuestions = questions.filter((_, i) => i !== idx);
    console.log('Questions after removal:', newQuestions);
    setQuestions(newQuestions);
  };

  const handleSave = () => {
    if (editingIndex === null) {
      setQuestions([...questions, editForm]);
    } else {
      setQuestions(questions.map((q, i) => (i === editingIndex ? editForm : q)));
    }
    setShowAdd(false);
    setEditForm(defaultQuestion());
    setEditingIndex(null);
  };

  const handleCancel = () => {
    setShowAdd(false);
    setEditForm(defaultQuestion());
    setEditingIndex(null);
  };

  const handleQuestionChange = (idx: number, field: string, value: any) => {
    setQuestions(questions.map((q, i) => (i === idx ? { ...q, [field]: value } : q)));
  };

  return (
    <Box fontFamily="Montserrat, sans-serif">
      <VStack align="stretch" spacing={3}>
        {questions.length === 0 && (
          <Box bg="#fff" borderRadius="md" p={3}>
            <Text color="gray.500">(No questions yet. Add your first question below.)</Text>
          </Box>
        )}
        {questions.map((q, idx) => (
          <Box key={idx} bg="#f9f9f9" borderRadius="md" p={3} border="1px solid #ececec">
            <HStack justify="space-between">
              <Box>
                <Text fontWeight="bold">{q.question_text}</Text>
                <Text fontSize="sm" color="gray.600">{QUESTION_TYPES.find(t => t.value === q.question_type)?.label}</Text>
                {q.question_type === 'multiple_choice' || q.question_type === 'checkbox' ? (
                  <Text fontSize="sm" color="gray.500">Options: {q.options?.join(', ')}</Text>
                ) : null}
                {q.is_required && <Text fontSize="xs" color="red.500">Required</Text>}
              </Box>
              <HStack>
                <IconButton aria-label="Edit" icon={<EditIcon />} size="sm" onClick={() => handleEdit(idx)} />
                <IconButton aria-label="Delete" icon={<DeleteIcon />} size="sm" onClick={() => handleRemove(idx)} />
              </HStack>
            </HStack>
            {q.question_type === 'signature' && (
              <VStack align="stretch" spacing={2} mt={2}>
                <FormControl>
                  <FormLabel fontSize="sm">Signature Style</FormLabel>
                  <Select
                    value={q.signatureStyle || 'draw'}
                    onChange={(e) => handleQuestionChange(idx, 'signatureStyle', e.target.value)}
                    fontFamily="Montserrat, sans-serif"
                  >
                    <option value="draw">Draw Signature</option>
                    <option value="type">Type Signature</option>
                    <option value="both">Both Options</option>
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Signature Color</FormLabel>
                  <Input
                    type="color"
                    value={q.signatureColor || '#000000'}
                    onChange={(e) => handleQuestionChange(idx, 'signatureColor', e.target.value)}
                    fontFamily="Montserrat, sans-serif"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Signature Width</FormLabel>
                  <Input
                    type="number"
                    value={q.signatureWidth || 300}
                    onChange={(e) => handleQuestionChange(idx, 'signatureWidth', parseInt(e.target.value))}
                    fontFamily="Montserrat, sans-serif"
                    min="200"
                    max="600"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Signature Height</FormLabel>
                  <Input
                    type="number"
                    value={q.signatureHeight || 150}
                    onChange={(e) => handleQuestionChange(idx, 'signatureHeight', parseInt(e.target.value))}
                    fontFamily="Montserrat, sans-serif"
                    min="100"
                    max="300"
                  />
                </FormControl>
              </VStack>
            )}
          </Box>
        ))}
        {showAdd && (
          <Box bg="#ececec" borderRadius="md" p={4} border="1px solid #d3d3d3">
            <VStack align="stretch" spacing={2}>
              <Input
                placeholder="Question text"
                value={editForm.question_text}
                onChange={e => setEditForm(f => ({ ...f, question_text: e.target.value }))}
                fontFamily="Montserrat, sans-serif"
              />
              <Select
                value={editForm.question_type}
                onChange={e => setEditForm(f => ({ ...f, question_type: e.target.value, options: [] }))}
                fontFamily="Montserrat, sans-serif"
              >
                {QUESTION_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </Select>
              {(editForm.question_type === 'multiple_choice' || editForm.question_type === 'checkbox') && (
                <Textarea
                  placeholder="Enter options, one per line"
                  value={editForm.options?.join('\n') || ''}
                  onChange={e => setEditForm(f => ({ ...f, options: e.target.value.split('\n') }))}
                  fontFamily="Montserrat, sans-serif"
                  rows={3}
                />
              )}
              <HStack>
                <label style={{ fontFamily: 'Montserrat, sans-serif', fontSize: '14px' }}>
                  <input
                    type="checkbox"
                    checked={editForm.is_required}
                    onChange={e => setEditForm(f => ({ ...f, is_required: e.target.checked }))}
                  />{' '}
                  Required
                </label>
              </HStack>
              <HStack spacing={3} mt={2}>
                <Button colorScheme="blue" size="sm" onClick={handleSave} fontFamily="Montserrat, sans-serif">{editingIndex === null ? 'Add' : 'Save'}</Button>
                <Button variant="outline" size="sm" onClick={handleCancel} fontFamily="Montserrat, sans-serif">Cancel</Button>
              </HStack>
            </VStack>
          </Box>
        )}
        <Button colorScheme="blue" size="sm" alignSelf="flex-start" onClick={handleAdd} fontFamily="Montserrat, sans-serif">
          + Add Question
        </Button>
      </VStack>
    </Box>
  );
};

export default QuestionEditor; 