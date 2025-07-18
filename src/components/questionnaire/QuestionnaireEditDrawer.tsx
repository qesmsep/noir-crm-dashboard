import React, { useState, useEffect } from 'react';
import {
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  Button,
  VStack,
  HStack,
  FormControl,
  FormLabel,
  Input,
  Switch,
  Textarea,
  Box,
  Divider,
  Text,
  Select,
  IconButton,
  useToast,
} from '@chakra-ui/react';
import QuestionEditor from './QuestionEditor';
import { CopyIcon } from '@chakra-ui/icons';
import { supabase } from '../../lib/supabase';

interface QuestionnaireEditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  questionnaire: any;
  onSave: (data: any) => void;
}

const QuestionnaireEditDrawer: React.FC<QuestionnaireEditDrawerProps> = ({
  isOpen,
  onClose,
  questionnaire,
  onSave,
}) => {
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [trackingMethod, setTrackingMethod] = useState('');
  const [memberIdOption, setMemberIdOption] = useState('');
  const [completionStep, setCompletionStep] = useState('');
  const [notificationOption, setNotificationOption] = useState('');
  const [otherOption, setOtherOption] = useState('');
  const [questions, setQuestions] = useState<any[]>([]);
  const [completionUrl, setCompletionUrl] = useState('');
  const [customStepText, setCustomStepText] = useState('');
  const [notificationEmail, setNotificationEmail] = useState('');
  const [otherOptionValue, setOtherOptionValue] = useState('');
  const [conditionalLogic, setConditionalLogic] = useState<any[]>([]);
  const [token, setToken] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(questionnaire?.name || '');
      setDescription(questionnaire?.description || '');
      setIsActive(questionnaire?.is_active ?? true);
      setTrackingMethod(questionnaire?.options?.trackingMethod || '');
      setMemberIdOption(questionnaire?.options?.memberIdOption || '');
      setCompletionStep(questionnaire?.options?.completionStep || '');
      setNotificationOption(questionnaire?.options?.notificationOption || '');
      setOtherOption(questionnaire?.options?.otherOption || '');
      setQuestions(questionnaire?.questions || []);
      setCompletionUrl(questionnaire?.options?.completionUrl || '');
      setCustomStepText(questionnaire?.options?.customStepText || '');
      setNotificationEmail(questionnaire?.options?.notificationEmail || '');
      setOtherOptionValue(questionnaire?.options?.otherOptionValue || '');
      setConditionalLogic(questionnaire?.conditional_logic || []);
      setToken(questionnaire?.token || '');
    }
  }, [isOpen, questionnaire]);

  useEffect(() => {
    if (trackingMethod === 'lookup_phone') {
      const hasPhone = questions.some(q => q.question_type === 'phone');
      if (!hasPhone) {
        setQuestions(prev => [
          ...prev,
          {
            question_text: 'Phone Number',
            question_type: 'phone',
            options: [],
            is_required: true,
          },
        ]);
      } else {
        setQuestions(prev => prev.map(q =>
          q.question_type === 'phone' ? { ...q, is_required: true } : q
        ));
      }
    }
  }, [trackingMethod]);

  const handleSave = () => {
    const saveData = {
      ...questionnaire,
      name,
      description,
      is_active: isActive,
      token,
      options: {
        trackingMethod,
        memberIdOption,
        completionStep,
        completionUrl,
        customStepText,
        notificationOption,
        notificationEmail,
        otherOption,
        otherOptionValue,
      },
      questions,
      conditional_logic: conditionalLogic,
    };
    
    console.log('Drawer handleSave called with data:', saveData);
    console.log('Questions being saved:', questions);
    console.log('Questions count:', questions.length);
    onSave(saveData);
  };

  const generateToken = async () => {
    try {
      const newToken = 'q_' + Math.random().toString(36).substring(2, 15);
      setToken(newToken);
      
      if (questionnaire?.id) {
        const { error } = await supabase
          .from('questionnaire_templates')
          .update({ token: newToken })
          .eq('id', questionnaire.id);
        
        if (error) throw error;
      }
    } catch (err) {
      console.error('Error generating token:', err);
    }
  };

  const copyToken = async () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const fullUrl = `${baseUrl}/questionnaire/${token}`;
    
    try {
      await navigator.clipboard.writeText(fullUrl);
      toast({
        title: 'Link copied!',
        description: 'Questionnaire link copied to clipboard',
        status: 'success',
        duration: 2000,
      });
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      placement="right"
      onClose={onClose}
      size="lg"
      closeOnOverlayClick={true}
      closeOnEsc={true}
    >
      <Box zIndex="2000" position="relative">
        <DrawerOverlay bg="blackAlpha.600" onClick={onClose} />
        <DrawerContent
          border="2px solid #353535"
          borderRadius="10px"
          fontFamily="Montserrat, sans-serif"
          maxW="50vw"
          w="50vw"
          boxShadow="xl"
          mt="80px"
          mb="25px"
          paddingRight="40px"
          paddingLeft="40px"
          backgroundColor="#ecede8"
          position="fixed"
          top="0"
          right="0"
                      style={{
              transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
              transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              fontFamily: 'Montserrat, sans-serif',
            }}
        >
          <DrawerHeader 
            borderBottomWidth="1px" 
            margin="0" 
            fontWeight="bold" 
            paddingTop="0px" 
            fontSize="24px"
            fontFamily="IvyJournal, sans-serif" 
            color="#353535"
            position="sticky"
            top="0"
            bg="#ecede8"
            zIndex="1"
          >
            {questionnaire?.id ? 'Edit Questionnaire' : 'Create Questionnaire'}
          </DrawerHeader>
          
          <DrawerBody 
            p={4} 
            overflowY="auto" 
            fontFamily="Montserrat, sans-serif" 
            className="drawer-body-content"
          >
            <VStack spacing={4} align="stretch">
              <FormControl>
                <FormLabel fontSize="md">Name</FormLabel>
                <Input 
                  placeholder="Questionnaire name" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  fontFamily="Montserrat, sans-serif"
                  size="md"
                />
              </FormControl>
              
              <FormControl>
                <FormLabel fontSize="md">Description</FormLabel>
                <Textarea 
                  placeholder="Description (optional)" 
                  rows={2} 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  fontFamily="Montserrat, sans-serif"
                  size="md"
                />
              </FormControl>
              
              <FormControl>
                <FormLabel fontSize="md">Public URL</FormLabel>
                <VStack align="stretch" spacing={2}>
                  <HStack>
                    <Input
                      value={token ? `${typeof window !== 'undefined' ? window.location.origin : ''}/questionnaire/${token}` : 'No public URL set'}
                      isReadOnly
                      fontFamily="monospace"
                      fontSize="sm"
                      placeholder="Generate a token to create public URL"
                    />
                    <Button
                      size="md"
                      onClick={generateToken}
                      colorScheme="blue"
                      variant="outline"
                    >
                      Generate
                    </Button>
                    {token && (
                      <IconButton
                        aria-label="Copy link"
                        icon={<CopyIcon />}
                        onClick={copyToken}
                        size="md"
                      />
                    )}
                  </HStack>
                  <Text fontSize="xs" color="gray.500">
                    This URL can be shared publicly to allow anyone to fill out the questionnaire
                  </Text>
                </VStack>
              </FormControl>
              
              <FormControl display="flex" alignItems="center">
                <FormLabel mb={0} fontSize="md">Active</FormLabel>
                <Switch 
                  colorScheme="green" 
                  isChecked={isActive} 
                  onChange={e => setIsActive(e.target.checked)}
                  size="lg"
                />
              </FormControl>
              
              <Divider />
              
              <Box>
                <Text fontWeight="bold" mb={2} fontFamily="Montserrat, sans-serif" fontSize="md">
                  Questions
                </Text>
                <QuestionEditor questions={questions} setQuestions={setQuestions} />
              </Box>
              
              <Divider />
              
              <Box>
                <Text fontWeight="bold" mb={2} fontFamily="Montserrat, sans-serif" fontSize="md">
                  Conditional Logic
                </Text>
                <Text fontSize="sm" color="gray.600" mb={4}>
                  Set up questions that show/hide based on previous answers
                </Text>
                <VStack align="stretch" spacing={3}>
                  {conditionalLogic.map((logic, idx) => (
                    <Box key={idx} p={3} borderWidth={1} borderRadius="md" bg="#f8f9fa">
                      <HStack justify="space-between" mb={2}>
                        <Text fontWeight="semibold" fontSize="md">Rule {idx + 1}</Text>
                        <Button 
                          size="sm" 
                          onClick={() => setConditionalLogic(prev => prev.filter((_, i) => i !== idx))}
                        >
                          Remove
                        </Button>
                      </HStack>
                      <VStack align="stretch" spacing={2}>
                        <Select
                          placeholder="Select trigger question"
                          value={logic.triggerQuestion}
                          onChange={e => setConditionalLogic(prev => prev.map((l, i) => 
                            i === idx ? { ...l, triggerQuestion: e.target.value } : l
                          ))}
                          fontFamily="Montserrat, sans-serif"
                          size="md"
                        >
                          {questions.map((q, qIdx) => (
                            <option key={qIdx} value={q.id}>{q.question_text}</option>
                          ))}
                        </Select>
                        <Select
                          placeholder="Select condition"
                          value={logic.condition}
                          onChange={e => setConditionalLogic(prev => prev.map((l, i) => 
                            i === idx ? { ...l, condition: e.target.value } : l
                          ))}
                          fontFamily="Montserrat, sans-serif"
                          size="md"
                        >
                          <option value="equals">Equals</option>
                          <option value="contains">Contains</option>
                          <option value="not_equals">Not equals</option>
                          <option value="greater_than">Greater than</option>
                          <option value="less_than">Less than</option>
                        </Select>
                        <Input
                          placeholder="Enter value"
                          value={logic.value}
                          onChange={e => setConditionalLogic(prev => prev.map((l, i) => 
                            i === idx ? { ...l, value: e.target.value } : l
                          ))}
                          fontFamily="Montserrat, sans-serif"
                          size="md"
                        />
                        <Select
                          placeholder="Select target question"
                          value={logic.targetQuestion}
                          onChange={e => setConditionalLogic(prev => prev.map((l, i) => 
                            i === idx ? { ...l, targetQuestion: e.target.value } : l
                          ))}
                          fontFamily="Montserrat, sans-serif"
                          size="md"
                        >
                          {questions.map((q, qIdx) => (
                            <option key={qIdx} value={q.id}>{q.question_text}</option>
                          ))}
                        </Select>
                        <Select
                          placeholder="Select action"
                          value={logic.action}
                          onChange={e => setConditionalLogic(prev => prev.map((l, i) => 
                            i === idx ? { ...l, action: e.target.value } : l
                          ))}
                          fontFamily="Montserrat, sans-serif"
                          size="md"
                        >
                          <option value="show">Show</option>
                          <option value="hide">Hide</option>
                          <option value="require">Make required</option>
                          <option value="optional">Make optional</option>
                        </Select>
                      </VStack>
                    </Box>
                  ))}
                  <Button
                    onClick={() => setConditionalLogic(prev => [...prev, {
                      triggerQuestion: '',
                      condition: '',
                      value: '',
                      targetQuestion: '',
                      action: '',
                    }])}
                    size="sm"
                    colorScheme="blue"
                  >
                    + Add Conditional Rule
                  </Button>
                </VStack>
              </Box>
              
              <Divider />
              
              <Box>
                <Text fontWeight="bold" mb={2} fontFamily="Montserrat, sans-serif" fontSize="md">
                  Options
                </Text>
                <VStack align="stretch" spacing={3}>
                  <Box>
                    <Text fontWeight="semibold" fontFamily="Montserrat, sans-serif" fontSize="md">
                      Tracking
                    </Text>
                    <Select
                      placeholder="Select tracking method"
                      value={trackingMethod}
                      onChange={e => setTrackingMethod(e.target.value)}
                      fontFamily="Montserrat, sans-serif"
                      size="md"
                    >
                      <option value="lookup_phone">Lookup member by phone</option>
                      <option value="create_unique_id">Create unique ID</option>
                      <option value="email_tracking">Track by email</option>
                      <option value="session_tracking">Track by session/cookie</option>
                      <option value="custom_tracking">Custom tracking method</option>
                    </Select>
                  </Box>
                  
                  <Box>
                    <Text fontWeight="semibold" fontFamily="Montserrat, sans-serif" fontSize="md">
                      Member ID
                    </Text>
                    <Select
                      placeholder="Select member ID option"
                      value={memberIdOption}
                      onChange={e => setMemberIdOption(e.target.value)}
                      fontFamily="Montserrat, sans-serif"
                      size="md"
                    >
                      <option value="lookup_id">Lookup member ID</option>
                      <option value="create_id">Create new member ID</option>
                      <option value="none">No member ID</option>
                    </Select>
                  </Box>
                  
                  <Box>
                    <Text fontWeight="semibold" fontFamily="Montserrat, sans-serif" fontSize="md">
                      Completion Steps
                    </Text>
                    <Select
                      placeholder="Select completion step"
                      value={completionStep}
                      onChange={e => setCompletionStep(e.target.value)}
                      fontFamily="Montserrat, sans-serif"
                      size="md"
                    >
                      <option value="thankyou">Show thank you message</option>
                      <option value="redirect">Go to URL</option>
                      <option value="notification">Send notification</option>
                      <option value="custom">Custom completion</option>
                    </Select>
                    {completionStep === 'redirect' && (
                      <Input
                        placeholder="Enter redirect URL"
                        value={completionUrl}
                        onChange={e => setCompletionUrl(e.target.value)}
                        mt={2}
                        fontFamily="Montserrat, sans-serif"
                        size="md"
                      />
                    )}
                    {completionStep === 'custom' && (
                      <Input
                        placeholder="Enter custom step text"
                        value={customStepText}
                        onChange={e => setCustomStepText(e.target.value)}
                        mt={2}
                        fontFamily="Montserrat, sans-serif"
                        size="md"
                      />
                    )}
                  </Box>
                  
                  <Box>
                    <Text fontWeight="semibold" fontFamily="Montserrat, sans-serif" fontSize="md">
                      Notifications
                    </Text>
                    <Select
                      placeholder="Select notification option"
                      value={notificationOption}
                      onChange={e => setNotificationOption(e.target.value)}
                      fontFamily="Montserrat, sans-serif"
                      size="md"
                    >
                      <option value="email">Send email</option>
                      <option value="sms">Send SMS</option>
                      <option value="both">Send both</option>
                      <option value="none">No notification</option>
                    </Select>
                    {(notificationOption === 'email' || notificationOption === 'both') && (
                      <Input
                        placeholder="Enter notification email"
                        value={notificationEmail}
                        onChange={e => setNotificationEmail(e.target.value)}
                        mt={2}
                        fontFamily="Montserrat, sans-serif"
                        size="md"
                      />
                    )}
                  </Box>
                  
                  <Box>
                    <Text fontWeight="semibold" fontFamily="Montserrat, sans-serif" fontSize="md">
                      Other Options
                    </Text>
                    <Select
                      placeholder="Select other option"
                      value={otherOption}
                      onChange={e => setOtherOption(e.target.value)}
                      fontFamily="Montserrat, sans-serif"
                      size="md"
                    >
                      <option value="track_analytics">Track analytics</option>
                      <option value="require_login">Require login</option>
                      <option value="limit_submissions">Limit submissions</option>
                      <option value="none">No special options</option>
                    </Select>
                    {otherOption === 'limit_submissions' && (
                      <Input
                        placeholder="Enter submission limit"
                        value={otherOptionValue}
                        onChange={e => setOtherOptionValue(e.target.value)}
                        mt={2}
                        fontFamily="Montserrat, sans-serif"
                        size="md"
                      />
                    )}
                  </Box>
                </VStack>
              </Box>
            </VStack>
          </DrawerBody>
          
          <DrawerFooter 
            borderTopWidth="1px" 
            position="sticky" 
            bottom="0" 
            bg="#ecede8"
            zIndex="1"
            className="drawer-footer-content"
          >
            <HStack spacing={3} width="100%" justify="space-between">
              <Button 
                onClick={onClose} 
                variant="outline"
                size="md"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSave} 
                colorScheme="blue"
                size="md"
              >
                Save
              </Button>
            </HStack>
          </DrawerFooter>
        </DrawerContent>
      </Box>
    </Drawer>
  );
};

export default QuestionnaireEditDrawer; 