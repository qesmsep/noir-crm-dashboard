import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { Box, VStack, Heading, Text, Input, Textarea, Button, Checkbox, Radio, RadioGroup, Stack, FormControl, FormLabel, useToast, HStack } from '@chakra-ui/react';
import { supabase } from '../../lib/supabase';

const QuestionnairePage = () => {
  const router = useRouter();
  const { token } = router.query;
  const [questionnaire, setQuestionnaire] = useState<any>(null);
  const [answers, setAnswers] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [completionStep, setCompletionStep] = useState<'form' | 'thankyou' | 'redirect'>('form');
  const [redirectUrl, setRedirectUrl] = useState('');
  const toast = useToast();
  const [fileAnswers, setFileAnswers] = useState<{ [idx: string]: string }>({});
  const [filePreviews, setFilePreviews] = useState<{ [idx: string]: string }>({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleQuestions, setVisibleQuestions] = useState<Set<string>>(new Set());
  const [requiredQuestions, setRequiredQuestions] = useState<Set<string>>(new Set());
  const [signatures, setSignatures] = useState<{ [key: string]: string }>({});
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [sessionId] = useState<string>(() => Math.random().toString(36).substring(2, 15));
  const [password, setPassword] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Check if all required signatures are completed
  const allRequiredSignaturesComplete = React.useMemo(() => {
    if (!questionnaire) return true;
    
    const requiredSignatureQuestions = questionnaire.questions.filter(
      (q: any) => q.question_type === 'signature' && requiredQuestions.has(String(q.id))
    );
    
    return requiredSignatureQuestions.every((q: any) => signatures[q.id]);
  }, [questionnaire, signatures, requiredQuestions]);

  React.useEffect(() => {
    const fetchQuestionnaire = async () => {
      try {
        const { data, error } = await supabase
          .from('questionnaire_templates')
          .select('*')
          .eq('token', token)
          .eq('is_active', true)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            setError('Questionnaire not found or inactive');
          } else {
            setError('Failed to load questionnaire');
          }
        } else {
          setQuestionnaire(data);
          
          // Check if password protection is enabled
          if (data.options?.password_protected) {
            setShowPasswordForm(true);
          }
        }
      } catch (err) {
        console.error('Error fetching questionnaire:', err);
        setError('Failed to load questionnaire');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchQuestionnaire();
    }
  }, [token]);

  React.useEffect(() => {
    if (questionnaire) {
      const visible = new Set<string>(questionnaire.questions.map((q: any) => String(q.id)));
      const required = new Set<string>(questionnaire.questions.filter((q: any) => q.is_required).map((q: any) => String(q.id)));
      setVisibleQuestions(visible);
      setRequiredQuestions(required);
    }
  }, [questionnaire]);

  // Track form view when component loads
  React.useEffect(() => {
    if (questionnaire) {
      trackAnalyticsEvent('view');
    }
  }, [questionnaire]);

  // Track form start when user begins interacting
  React.useEffect(() => {
    if (questionnaire && Object.keys(answers).length > 0) {
      trackAnalyticsEvent('start');
    }
  }, [answers]);

  // Analytics tracking function
  const trackAnalyticsEvent = async (eventType: string) => {
    if (!questionnaire) return;
    
    try {
      const completionTime = eventType === 'complete' ? 
        Math.round((Date.now() - startTime) / 1000) : null;

      await fetch('/api/questionnaire-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionnaireId: questionnaire.id,
          eventType,
          sessionId,
          completionTime,
          referrer: document.referrer,
        }),
      });
    } catch (err) {
      console.error('Error tracking analytics:', err);
    }
  };

  const checkConditionalLogic = (updatedAnswers: any) => {
    if (!questionnaire?.conditional_logic) return;

    const newVisible = new Set(visibleQuestions);
    const newRequired = new Set(requiredQuestions);

    questionnaire.conditional_logic.forEach((logic: any) => {
      const triggerValue = updatedAnswers[logic.triggerQuestion];
      const targetQuestion = logic.targetQuestion;
      
      let shouldApply = false;
      
      switch (logic.condition) {
        case 'equals':
          shouldApply = triggerValue === logic.value;
          break;
        case 'contains':
          shouldApply = triggerValue && triggerValue.includes(logic.value);
          break;
        case 'not_equals':
          shouldApply = triggerValue !== logic.value;
          break;
        case 'greater_than':
          shouldApply = Number(triggerValue) > Number(logic.value);
          break;
        case 'less_than':
          shouldApply = Number(triggerValue) < Number(logic.value);
          break;
      }

      if (shouldApply) {
        switch (logic.action) {
          case 'show':
            newVisible.add(targetQuestion);
            break;
          case 'hide':
            newVisible.delete(targetQuestion);
            break;
          case 'require':
            newRequired.add(targetQuestion);
            break;
          case 'optional':
            newRequired.delete(targetQuestion);
            break;
        }
      }
    });

    setVisibleQuestions(newVisible);
    setRequiredQuestions(newRequired);
  };

  const handleChange = (questionId: string, value: any) => {
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);
    checkConditionalLogic(newAnswers);
  };

  const handleFileChange = (idx: number, file: File | null) => {
    setAnswers((prev: any) => ({ ...prev, [idx]: file }));
  };

  const handleSignature = (questionId: string, signatureData: string) => {
    setSignatures(prev => ({ ...prev, [questionId]: signatureData }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    
    console.log('Form submission started');
    console.log('Questionnaire:', questionnaire);
    console.log('Answers:', answers);
    console.log('File answers:', fileAnswers);
    console.log('Signatures:', signatures);
    
    // Validate required fields
    for (let i = 0; i < questionnaire.questions.length; i++) {
      const q = questionnaire.questions[i];
      if (requiredQuestions.has(String(q.id)) && !answers[q.id] && !fileAnswers[q.id] && !signatures[q.id]) {
        setUploadError(`Please fill in: ${q.question_text}`);
        return;
      }
    }
    
    setSubmitting(true);
    try {
      // Track completion event
      await trackAnalyticsEvent('complete');
      
      const requestBody = {
        questionnaireId: questionnaire.id,
        answers,
        files: fileAnswers,
        signatures,
        meta: { 
          token,
          sessionId,
          referrer: document.referrer,
          completionTime: Math.round((Date.now() - startTime) / 1000),
        },
      };
      
      console.log('Sending request to API:', requestBody);
      
      const res = await fetch('/api/questionnaire-responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      
      console.log('API response status:', res.status);
      console.log('API response ok:', res.ok);
      
      if (res.ok) {
        const responseData = await res.json();
        console.log('API response data:', responseData);
        
        // Handle completion logic based on questionnaire options
        const completionOption = questionnaire.options?.completionStep;
        
        console.log('Completion option:', completionOption);
        console.log('Questionnaire options:', questionnaire.options);
        
        if (completionOption === 'redirect' && questionnaire.options?.completionUrl) {
          console.log('Setting redirect URL:', questionnaire.options.completionUrl);
          setRedirectUrl(questionnaire.options.completionUrl);
          setCompletionStep('redirect');
        } else if (completionOption === 'notification') {
          // Send notification (could be email, SMS, etc.)
          if (questionnaire.options?.notificationEmail) {
            // TODO: Implement notification sending
            console.log('Sending notification to:', questionnaire.options.notificationEmail);
          }
          setCompletionStep('thankyou');
        } else {
          // Default: show thank you message
          setCompletionStep('thankyou');
        }
        
        // Mock response for admin review (if in browser)
        if (typeof window !== 'undefined' && window.mockSubmitQuestionnaireResponse) {
          window.mockSubmitQuestionnaireResponse({
            questionnaireId: questionnaire.id,
            answers: { ...answers, ...fileAnswers, ...signatures },
            meta: { token },
          });
        }
      } else {
        const errorData = await res.text();
        console.error('API error response:', errorData);
        setUploadError('Submission failed.');
      }
    } catch (err) {
      console.error('Form submission error:', err);
      setUploadError('Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const SignaturePad = ({ questionId, question, onSignature }: any) => {
    const [signatureMode, setSignatureMode] = useState<'draw' | 'type'>('draw');
    const [typedSignature, setTypedSignature] = useState('');
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = React.useState(false);

    const clearCanvas = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    };

    const saveSignature = () => {
      if (signatureMode === 'draw') {
        const canvas = canvasRef.current;
        if (canvas) {
          const dataUrl = canvas.toDataURL();
          onSignature(questionId, dataUrl);
        }
      } else if (signatureMode === 'type' && typedSignature.trim()) {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.font = '48px cursive';
            ctx.fillStyle = question.signatureColor || '#000000';
            ctx.fillText(typedSignature, 10, 80);
            const dataUrl = canvas.toDataURL();
            onSignature(questionId, dataUrl);
          }
        }
      }
    };

    React.useEffect(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        // Set canvas size to match display size
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.strokeStyle = question.signatureColor || '#000000';
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
        }
      }
    }, [question]);

    const handleMouseDown = (e: React.MouseEvent) => {
      if (signatureMode === 'draw') {
        setIsDrawing(true);
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const rect = canvas.getBoundingClientRect();
            ctx.beginPath();
            ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
          }
        }
      }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
      if (isDrawing && signatureMode === 'draw') {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const rect = canvas.getBoundingClientRect();
            ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
            ctx.stroke();
          }
        }
      }
    };

    const handleMouseUp = () => {
      setIsDrawing(false);
    };

    return (
      <Box>
        <HStack spacing={3} mb={4} flexWrap="wrap">
          {question.signatureStyle !== 'type' && (
            <Button
              size="sm"
              onClick={() => setSignatureMode('draw')}
              colorScheme={signatureMode === 'draw' ? 'yellow' : 'gray'}
              borderRadius="1rem"
              bg={signatureMode === 'draw' ? '#a59480' : 'rgba(255, 255, 255, 0.2)'}
              color="#ECEDE8"
              _hover={{
                bg: signatureMode === 'draw' ? '#8B7A6A' : 'rgba(255, 255, 255, 0.3)'
              }}
            >
              Draw
            </Button>
          )}
          {question.signatureStyle !== 'draw' && (
            <Button
              size="sm"
              onClick={() => setSignatureMode('type')}
              colorScheme={signatureMode === 'type' ? 'yellow' : 'gray'}
              borderRadius="1rem"
              bg={signatureMode === 'type' ? '#a59480' : 'rgba(255, 255, 255, 0.2)'}
              color="#ECEDE8"
              _hover={{
                bg: signatureMode === 'type' ? '#8B7A6A' : 'rgba(255, 255, 255, 0.3)'
              }}
            >
              Type
            </Button>
          )}
          <Button 
            size="sm" 
            onClick={clearCanvas}
            borderRadius="1rem"
            bg="rgba(255, 255, 255, 0.2)"
            color="#ECEDE8"
            _hover={{
              bg: "rgba(255, 255, 255, 0.3)"
            }}
          >
            Clear
          </Button>
          <Button 
            size="sm" 
            colorScheme="yellow" 
            onClick={saveSignature}
            borderRadius="1rem"
            bg="#a59480"
            color="#ECEDE8"
            _hover={{
              bg: "#8B7A6A"
            }}
          >
            Save Signature
          </Button>
        </HStack>
        
        {signatureMode === 'type' && (
          <Input
            placeholder="Type your signature"
            value={typedSignature}
            onChange={(e) => setTypedSignature(e.target.value)}
            mb={4}
            fontFamily="cursive"
            fontSize="lg"
            bg="rgba(255, 255, 255, 0.9)"
            border="1px solid rgba(255, 255, 255, 0.2)"
            borderRadius="0.5rem"
            _focus={{
              borderColor: "#a59480",
              boxShadow: "0 0 0 1px #a59480"
            }}
            color="#353535"
          />
        )}
        
        <Box 
          border="1px solid rgba(255, 255, 255, 0.3)"
          borderRadius="0.5rem"
          bg="rgba(255, 255, 255, 0.9)"
          p={2}
          width="100%"
        >
          <canvas
            ref={canvasRef}
            style={{
              width: '100%',
              height: '150px',
              cursor: signatureMode === 'draw' ? 'crosshair' : 'default',
              display: 'block'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </Box>
        
        {signatures[questionId] && (
          <Box mt={4}>
            <Text fontSize="sm" color="green.400" fontFamily="Montserrat, sans-serif">Signature saved ✓</Text>
            <img 
              src={signatures[questionId]} 
              alt="Signature" 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '150px',
                marginTop: 8,
                borderRadius: '0.5rem',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }} 
            />
          </Box>
        )}
      </Box>
    );
  };

  // Handle password submission
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    
    if (questionnaire?.options?.password === password) {
      setShowPasswordForm(false);
    } else {
      setPasswordError('Incorrect password');
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
      >
        <Box 
          maxW="400px" 
          w="100%" 
          mx="auto"
          bg="rgba(0, 0, 0, 0.8)"
          borderRadius="1rem"
          p={8}
          boxShadow="0 4px 6px rgba(0, 0, 0, 0.1)"
          textAlign="center"
          
          mb={8}
          position="relative"
          zIndex={10}
        >
          <Text color="#ECEDE8" fontSize="lg">Loading questionnaire...</Text>
        </Box>
      </Box>
    );
  }

  if (error || !questionnaire) {
    return (
      <Box 
        minH="100vh" 
        fontFamily="Montserrat, sans-serif"
        background="linear-gradient(rgba(53,53,53,0.6), rgba(53,53,53,0.6)), url('/images/LPR67899.JPG') center/cover no-repeat"
        backgroundAttachment="fixed"
        position="relative"
      >
        <Box 
          maxW="400px" 
          w="100%" 
          mx="auto"
          bg="rgba(0, 0, 0, 0.8)"
          borderRadius="1rem"
          p={8}
          boxShadow="0 4px 6px rgba(0, 0, 0, 0.1)"
          textAlign="center"
         
          mb={8}
          position="relative"
          zIndex={10}
        >
          <Text color="red.400" fontSize="lg">{error || 'Questionnaire not found'}</Text>
        </Box>
      </Box>
    );
  }

  if (showPasswordForm) {
    return (
      <Box 
        minH="100vh" 
        fontFamily="Montserrat, sans-serif"
        background="linear-gradient(rgba(53,53,53,0.6), rgba(53,53,53,0.6)), url('/images/LPR67899.JPG') center/cover no-repeat"
        backgroundAttachment="fixed"
        position="relative"
      >
        <Box 
          maxW="400px" 
          w="100%" 
          mx="auto"
          bg="rgba(0, 0, 0, 0.8)"
          borderRadius="1rem"
          p={8}
          boxShadow="0 4px 6px rgba(0, 0, 0, 0.1)"
          textAlign="center"
          
          mb={8}
          position="relative"
          zIndex={10}
        >
          <VStack spacing={6}>
            <Heading size="lg" color="#ECEDE8" fontFamily="IvyJournal, sans-serif">
              Password Required
            </Heading>
            <Text color="#ECEDE8" opacity={0.4}>
              This questionnaire is password protected. Please enter the password to continue.
            </Text>
            
            <form onSubmit={handlePasswordSubmit} style={{ width: '100%' }}>
              <VStack spacing={4}>
                <FormControl isInvalid={!!passwordError}>
                  <Input
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    fontFamily="Montserrat, sans-serif"
                    size="lg"
                    bg="rgba(255, 255, 255, 0.9)"
                    border="1px solid rgba(255, 255, 255, 0.2)"
                    borderRadius="0.5rem"
                    _focus={{
                      borderColor: "#a59480",
                      boxShadow: "0 0 0 1px #a59480"
                    }}
                    color="#353535"
                  />
                  {passwordError && (
                    <Text color="red.400" fontSize="sm" mt={1}>
                      {passwordError}
                    </Text>
                  )}
                </FormControl>
                
                <Button
                  type="submit"
                  colorScheme="yellow"
                  size="lg"
                  width="100%"
                  fontFamily="Montserrat, sans-serif"
                  borderRadius="2rem"
                  bg="#a59480"
                  color="#ECEDE8"
                  _hover={{
                    bg: "#8B7A6A",
                    transform: "translateY(-1px)"
                  }}
                  _active={{
                    transform: "translateY(0)"
                  }}
                  boxShadow="0 4px 12px rgba(0, 0, 0, 0.15)"
                >
                  Continue
                </Button>
              </VStack>
            </form>
          </VStack>
        </Box>
      </Box>
    );
  }

  if (completionStep === 'redirect') {
    React.useEffect(() => {
      if (redirectUrl) {
        window.location.href = redirectUrl;
      }
    }, [redirectUrl]);
    
    return (
      <Box 
        minH="100vh" 
        fontFamily="Montserrat, sans-serif"
        background="linear-gradient(rgba(53,53,53,0.6), rgba(53,53,53,0.6)), url('/images/LPR67899.JPG') center/cover no-repeat"
        backgroundAttachment="fixed"
        position="relative"
      >
        <Box 
          maxW="400px" 
          w="100%" 
          mx="auto"
          bg="rgba(0, 0, 0, 0.8)"
          borderRadius="1rem"
          p={8}
          boxShadow="0 4px 6px rgba(0, 0, 0, 0.1)"
          textAlign="center"
         
          mb={8}
          position="relative"
          zIndex={10}
        >
          <Text fontSize="lg" mb={4} color="#ECEDE8">Redirecting...</Text>
          <Text fontSize="sm" color="#ECEDE8" opacity={0.7}>You will be redirected shortly...</Text>
        </Box>
      </Box>
    );
  } else if (completionStep === 'thankyou') {
    return (
      <Box 
        minH="100vh" 
        fontFamily="Montserrat, sans-serif"
        background="linear-gradient(rgba(53,53,53,0.6), rgba(53,53,53,0.6)), url('/images/LPR67899.JPG') center/cover no-repeat"
        backgroundAttachment="fixed"
        position="relative"
      >
        <Box 
          maxW="600px" 
          w="100%" 
          mx="auto"
          bg="rgba(0, 0, 0, 0.8)"
          borderRadius="1rem"
          p={8}
          boxShadow="0 4px 6px rgba(0, 0, 0, 0.1)"
          textAlign="center"
          
          mb={8}
          position="relative"
          zIndex={10}
        >
          <Text fontSize="2xl" fontWeight="bold" mb={4} fontFamily="IvyJournal, sans-serif" color="#ECEDE8">
            Thank you!
          </Text>
          <Text fontSize="lg" mb={6} color="#ECEDE8" opacity={0.4}>
            {questionnaire.thank_you?.message || 'Your response has been submitted successfully.'}
          </Text>
          {questionnaire.faq && questionnaire.faq.length > 0 && (
            <Box mt={8}>
              <Text fontSize="lg" fontWeight="bold" mb={4} color="#ECEDE8">Frequently Asked Questions</Text>
              <VStack align="stretch" spacing={3}>
                {questionnaire.faq.map((faqItem, idx) => (
                  <Box 
                    key={idx} 
                    p={4} 
                    borderWidth={1} 
                    borderRadius="0.75rem" 
                    bg="rgba(255, 255, 255, 0.1)"
                    borderColor="rgba(255, 255, 255, 0.2)"
                  >
                    <Text color="#ECEDE8" fontFamily="Montserrat, sans-serif">{faqItem}</Text>
                  </Box>
                ))}
              </VStack>
            </Box>
          )}
        </Box>
      </Box>
    );
  }

  return (
    <Box 
      minH="100vh" 
      fontFamily="Montserrat, sans-serif"
      background="linear-gradient(rgba(53,53,53,0.6), rgba(53,53,53,0.6)), url('/images/LPR67899.JPG') center/cover no-repeat"
      backgroundAttachment="fixed"
      position="relative"
    >
      <Box 
        maxW="800px" 
        w="100%" 
        mx="auto"
        bg="rgba(0, 0, 0, 0.8)"
        borderRadius="1rem"
        p={8}
        boxShadow="0 4px 6px rgba(0, 0, 0, 0.1)"
        paddingTop={100}
        mb={8}
        maxH="100%"
        overflowY="auto"
        position="relative"
        zIndex={10}
      >
        <VStack spacing={6} align="stretch" >
          <Heading 
            size="lg" 
            color="#ECEDE8" 
            mb={4} 
            fontFamily="IvyJournal, sans-serif"
            textAlign="center"
            width="100%"
            
          >
            {questionnaire.name}
          </Heading>
          <Text 
            mb={6} 
            color="#ECEDE8" 
            fontFamily="Montserrat, sans-serif"
            textAlign="center"
            opacity={0.4}
          >
            {questionnaire.description}
          </Text>
          <form onSubmit={handleSubmit}>
            <VStack spacing={10} align="stretch">
              {questionnaire.questions.map((q: any, idx: number) => (
                <Box
                  key={q.id || idx}
                  
                  display={visibleQuestions.has(String(q.id)) ? 'block' : 'none'}
                  transition="all 0.3s ease"
                  bg="rgba(255, 255, 255, 0.1)"
                  borderRadius="0.75rem"
                  p={6}
                  border="1px solid rgba(255, 255, 255, 0.1)"
                >
                  <FormControl 
                    isRequired={requiredQuestions.has(String(q.id))}
                  >
                    <FormLabel 
                      fontFamily="Montserrat, sans-serif"
                      color="#ECEDE8"
                      fontSize="md"
                      fontWeight="500"
                      mb={3}
                    >
                      {q.question_text}
                      {requiredQuestions.has(String(q.id)) && <Text as="span" color="red.400"> *</Text>}
                    </FormLabel>
                    {q.description && (
                      <Text 
                        fontSize="sm" 
                        color="#ECEDE8" 
                        mb={3} 
                        fontFamily="Montserrat, sans-serif"
                        opacity={0.4}
                      >
                        {q.description}
                      </Text>
                    )}
                    {q.question_type === 'text' && (
                      <Input 
                        value={answers[q.id] || ''} 
                        onChange={e => handleChange(q.id, e.target.value)} 
                        fontFamily="Montserrat, sans-serif" 
                        placeholder={q.placeholder || ''}
                        bg="rgba(255, 255, 255, 0.9)"
                        border="1px solid rgba(255, 255, 255, 0.2)"
                        borderRadius="0.5rem"
                        _focus={{
                          borderColor: "#a59480",
                          boxShadow: "0 0 0 1px #a59480"
                        }}
                        color="#353535"
                      />
                    )}
                    {q.question_type === 'phone' && (
                      <Input 
                        type="tel" 
                        value={answers[q.id] || ''} 
                        onChange={e => handleChange(q.id, e.target.value)} 
                        fontFamily="Montserrat, sans-serif" 
                        placeholder={q.placeholder || '(555) 555-5555'}
                        bg="rgba(255, 255, 255, 0.9)"
                        border="1px solid rgba(255, 255, 255, 0.2)"
                        borderRadius="0.5rem"
                        _focus={{
                          borderColor: "#a59480",
                          boxShadow: "0 0 0 1px #a59480"
                        }}
                        color="#353535"
                      />
                    )}
                    {q.question_type === 'textarea' && (
                      <Textarea 
                        value={answers[q.id] || ''} 
                        onChange={e => handleChange(q.id, e.target.value)} 
                        fontFamily="Montserrat, sans-serif" 
                        placeholder={q.placeholder || ''}
                        bg="rgba(255, 255, 255, 0.9)"
                        border="1px solid rgba(255, 255, 255, 0.2)"
                        borderRadius="0.5rem"
                        _focus={{
                          borderColor: "#a59480",
                          boxShadow: "0 0 0 1px #a59480"
                        }}
                        color="#353535"
                        minH="100px"
                      />
                    )}
                    {q.question_type === 'multiple_choice' && (
                      <RadioGroup value={answers[q.id] || ''} onChange={val => handleChange(q.id, val)}>
                        <Stack direction="column" spacing={3}>
                          {q.options?.map((opt: string, oidx: number) => (
                            <Radio 
                              key={oidx} 
                              value={opt} 
                              fontFamily="Montserrat, sans-serif"
                              colorScheme="yellow"
                              color="#ECEDE8"
                            >
                              {opt}
                            </Radio>
                          ))}
                        </Stack>
                      </RadioGroup>
                    )}
                    {q.question_type === 'checkbox' && (
                      <Stack direction="column" spacing={3}>
                        {q.options?.map((opt: string, oidx: number) => (
                          <Checkbox
                            key={oidx}
                            isChecked={Array.isArray(answers[q.id]) && answers[q.id]?.includes(opt)}
                            onChange={e => {
                              const arr = Array.isArray(answers[q.id]) ? [...answers[q.id]] : [];
                              if (e.target.checked) arr.push(opt); else arr.splice(arr.indexOf(opt), 1);
                              handleChange(q.id, arr);
                            }}
                            fontFamily="Montserrat, sans-serif"
                            colorScheme="yellow"
                            color="#ECEDE8"
                          >
                            {opt}
                          </Checkbox>
                        ))}
                      </Stack>
                    )}
                    {q.question_type === 'date' && (
                      <Input 
                        type="date" 
                        value={answers[q.id] || ''} 
                        onChange={e => handleChange(q.id, e.target.value)} 
                        fontFamily="Montserrat, sans-serif"
                        bg="rgba(255, 255, 255, 0.9)"
                        border="1px solid rgba(255, 255, 255, 0.2)"
                        borderRadius="0.5rem"
                        _focus={{
                          borderColor: "#a59480",
                          boxShadow: "0 0 0 1px #a59480"
                        }}
                        color="#353535"
                      />
                    )}
                    {q.question_type === 'file' || q.question_type === 'photo' ? (
                      <Box>
                        <input
                          type="file"
                          accept={q.question_type === 'photo' ? 'image/*' : undefined}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                const base64 = ev.target?.result as string;
                                setFileAnswers((prev) => ({ ...prev, [q.id]: base64 }));
                                if (q.question_type === 'photo') {
                                  setFilePreviews((prev) => ({ ...prev, [q.id]: base64 }));
                                }
                              };
                              reader.readAsDataURL(file);
                            } catch (err) {
                              setUploadError('Failed to read file.');
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            backgroundColor: 'rgba(255, 255, 255, 0.9)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '0.5rem',
                            color: '#353535',
                            fontFamily: 'Montserrat, sans-serif'
                          }}
                        />
                        {filePreviews[q.id] && (
                          <Box mt={3}>
                            <img 
                              src={filePreviews[q.id]} 
                              alt="Preview" 
                              style={{ 
                                maxWidth: '100%', 
                                maxHeight: '200px',
                                borderRadius: '0.5rem',
                                objectFit: 'cover'
                              }} 
                            />
                          </Box>
                        )}
                      </Box>
                    ) : null}
                    {q.question_type === 'signature' && (
                      <SignaturePad
                        questionId={q.id}
                        question={q}
                        onSignature={handleSignature}
                      />
                    )}
                  </FormControl>
                </Box>
              ))}
              <Button 
                type="submit" 
                colorScheme="yellow" 
                isLoading={submitting} 
                isDisabled={!allRequiredSignaturesComplete}
                fontFamily="Montserrat, sans-serif"
                borderRadius="2rem"
                size="lg"
                bg={allRequiredSignaturesComplete ? "#a59480" : "rgba(165, 148, 128, 0.5)"}
                color="#ECEDE8"
                _hover={{
                  bg: allRequiredSignaturesComplete ? "#8B7A6A" : "rgba(165, 148, 128, 0.5)",
                  transform: allRequiredSignaturesComplete ? "translateY(-1px)" : "none"
                }}
                _active={{
                  transform: allRequiredSignaturesComplete ? "translateY(0)" : "none"
                }}
                boxShadow="0 4px 12px rgba(0, 0, 0, 0.15)"
                opacity={allRequiredSignaturesComplete ? 1 : 0.8}
                cursor={allRequiredSignaturesComplete ? "pointer" : "not-allowed"}
              >
                {!allRequiredSignaturesComplete ? 'Complete Required Signatures' : 'Submit'}
              </Button>
            </VStack>
          </form>
        </VStack>
      </Box>
    </Box>
  );
};

export default QuestionnairePage; 