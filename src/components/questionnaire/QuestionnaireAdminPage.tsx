import React, { useState } from 'react';
import AdminLayout from '../layouts/AdminLayout';
import { Box, Heading, Button, VStack, HStack, Text, Input, useToast, Table, Thead, Tbody, Tr, Th, Td, Switch, IconButton, Stat, StatLabel, StatNumber, StatHelpText, SimpleGrid, Select, Badge, Drawer, DrawerOverlay, DrawerContent, DrawerHeader, DrawerBody, DrawerFooter } from '@chakra-ui/react';
import { EditIcon, DeleteIcon, CopyIcon, ViewIcon, CheckCircleIcon, LinkIcon, ExternalLinkIcon } from '@chakra-ui/icons';
import QuestionnaireEditDrawer from './QuestionnaireEditDrawer';
import { sampleQuestionnaires } from './sampleQuestionnaires';
import { useDisclosure, Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter, AlertDialog, AlertDialogBody, AlertDialogFooter, AlertDialogHeader, AlertDialogContent, AlertDialogOverlay } from '@chakra-ui/react';
import { supabase, supabaseAdmin } from '../../lib/supabase';

// Add this type for window extension
declare global {
  interface Window {
    mockSubmitQuestionnaireResponse?: (data: any) => void;
  }
}

function defaultQuestionnaire() {
  return {
    id: null,
    name: '',
    description: '',
    is_active: true,
    options: {},
    questions: [],
    last_updated: new Date().toISOString(),
  };
}

const QuestionnaireAdminPage: React.FC = () => {
  const [notificationPhone, setNotificationPhone] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('notificationPhone') || '';
    }
    return '';
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit' | 'duplicate'>('create');
  const [questionnaires, setQuestionnaires] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editForm, setEditForm] = useState<any>(defaultQuestionnaire());
  const toast = useToast();
  const [responseModalOpen, setResponseModalOpen] = useState(false);
  const [responseModalQ, setResponseModalQ] = useState<any>(null);
  const [responses, setResponses] = useState<any[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [analytics, setAnalytics] = useState<any>({});
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [dateRange, setDateRange] = useState('7d');
  const [analyticsData, setAnalyticsData] = useState<any>({});
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareModalQ, setShareModalQ] = useState<any>(null);
  const [sharePassword, setSharePassword] = useState('');
  const [shareLink, setShareLink] = useState('');
  
  // Store sample questionnaire responses in memory
  const [sampleResponses, setSampleResponses] = useState<{ [questionnaireId: string]: any[] }>({});

  // Simulate receiving a response (for demo/testing)
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      window.mockSubmitQuestionnaireResponse = (data: any) => {
        // Store in sample responses if it's a sample questionnaire
        if (data.questionnaireId && typeof data.questionnaireId === 'string' && !data.questionnaireId.includes('-')) {
          setSampleResponses(prev => ({
            ...prev,
            [data.questionnaireId]: [...(prev[data.questionnaireId] || []), data]
          }));
        } else {
          setResponses(prev => [...prev, data]);
        }
      };
    }
    return () => {};
  }, []);

  // Save notification phone
  const handleSavePhone = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('notificationPhone', notificationPhone);
    }
    toast({
      title: 'Notification phone updated',
      description: `SMS notifications will be sent to ${notificationPhone}`,
      status: 'success',
      duration: 3000,
    });
  };

  // Fetch questionnaires from Supabase
  const fetchQuestionnaires = async () => {
    setLoading(true);
    try {
      console.log('Fetching questionnaires from database...');
      const { data, error } = await supabaseAdmin
        .from('questionnaire_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching questionnaires:', error);
        toast({
          title: 'Error',
          description: 'Failed to load questionnaires',
          status: 'error',
          duration: 3000,
        });
        // Fallback to sample questionnaires
        setQuestionnaires([...sampleQuestionnaires]);
      } else {
        console.log('Fetched questionnaires from database:', data);
        const finalQuestionnaires = data || [...sampleQuestionnaires];
        console.log('Setting questionnaires state to:', finalQuestionnaires);
        console.log('Questionnaire details:', finalQuestionnaires.map(q => ({
          id: q.id,
          name: q.name,
          description: q.description,
          questions_count: q.questions?.length,
          updated_at: q.updated_at
        })));
        console.log('Questions in Member Application Form:', finalQuestionnaires.find(q => q.name === 'Member Application Form')?.questions);
        setQuestionnaires(finalQuestionnaires);
      }
    } catch (err) {
      console.error('Error:', err);
      // Fallback to sample questionnaires
      setQuestionnaires([...sampleQuestionnaires]);
    } finally {
      setLoading(false);
    }
  };

  // Load questionnaires on component mount
  React.useEffect(() => {
    fetchQuestionnaires();
  }, []);

  // Save questionnaire to Supabase
  const saveQuestionnaire = async (data: any) => {
    try {
      console.log('Attempting to save questionnaire to database:', data);
      
      if (data.id) {
        // Update existing
        console.log('Updating existing questionnaire with ID:', data.id);
        const updateData = {
          name: data.name,
          description: data.description,
          is_active: data.is_active,
          options: data.options,
          questions: data.questions,
          conditional_logic: data.conditional_logic,
          token: data.token,
          updated_at: new Date().toISOString(),
        };
        
        console.log('Update data being sent to database:', updateData);
        console.log('Questions array being sent:', updateData.questions);
        
        const { data: updateResult, error } = await supabaseAdmin
          .from('questionnaire_templates')
          .update(updateData)
          .eq('id', data.id)
          .select();

        if (error) {
          console.error('Supabase update error:', error);
          throw error;
        }
        console.log('Questionnaire updated successfully');
        console.log('Update result:', updateResult);
      } else {
        // Create new
        console.log('Creating new questionnaire');
        const { error } = await supabaseAdmin
          .from('questionnaire_templates')
          .insert({
            name: data.name,
            description: data.description,
            is_active: data.is_active,
            options: data.options,
            questions: data.questions,
            conditional_logic: data.conditional_logic,
            token: data.token,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (error) {
          console.error('Supabase insert error:', error);
          throw error;
        }
        console.log('Questionnaire created successfully');
      }

      // Refresh the list
      console.log('Refreshing questionnaire list after save...');
      await fetchQuestionnaires();
      console.log('Questionnaire list refreshed successfully');
      toast({
        title: 'Success',
        description: data.id ? 'Questionnaire updated' : 'Questionnaire created',
        status: 'success',
        duration: 3000,
      });
    } catch (err: any) {
      console.error('Error saving questionnaire:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to save questionnaire',
        status: 'error',
        duration: 3000,
      });
    }
  };

  // Delete questionnaire from Supabase
  const deleteQuestionnaire = async (id: string) => {
    try {
      const { error } = await supabaseAdmin
        .from('questionnaire_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchQuestionnaires();
      toast({
        title: 'Deleted',
        description: 'Questionnaire deleted successfully',
        status: 'success',
        duration: 2000,
      });
    } catch (err: any) {
      console.error('Error deleting questionnaire:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to delete questionnaire',
        status: 'error',
        duration: 3000,
      });
    }
  };

  // Open drawer for create
  const handleCreate = () => {
    setEditForm(defaultQuestionnaire());
    setEditingIndex(null);
    setDrawerMode('create');
    setIsDrawerOpen(true);
  };

  // Open drawer for edit
  const handleEdit = (idx: number) => {
    setEditForm({ ...questionnaires[idx] });
    setEditingIndex(idx);
    setDrawerMode('edit');
    setIsDrawerOpen(true);
  };

  // Open drawer for duplicate
  const handleDuplicate = (idx: number) => {
    const copy = { ...questionnaires[idx], id: null, name: questionnaires[idx].name + ' (Copy)' };
    setEditForm(copy);
    setEditingIndex(null);
    setDrawerMode('duplicate');
    setIsDrawerOpen(true);
  };

  // Delete questionnaire
  const handleDelete = async (idx: number) => {
    const questionnaire = questionnaires[idx];
    if (questionnaire.id) {
      await deleteQuestionnaire(questionnaire.id);
    } else {
      // Handle in-memory deletion for sample questionnaires
      setQuestionnaires(qs => qs.filter((_, i) => i !== idx));
      toast({ title: 'Deleted', status: 'info', duration: 2000 });
    }
  };

  // Toggle active/inactive
  const handleToggleActive = (idx: number) => {
    setQuestionnaires(qs => qs.map((q, i) => i === idx ? { ...q, is_active: !q.is_active } : q));
  };

  // Save from drawer
  const handleSaveDrawer = async (data: any) => {
    console.log('Saving questionnaire data:', data);
    
    // Check if this is a sample questionnaire
    if (data.id && typeof data.id === 'string' && !data.id.includes('-')) {
      // Handle sample questionnaire save
      setQuestionnaires(qs => qs.map((q, i) => 
        q.id === data.id ? { ...data, last_updated: new Date().toISOString() } : q
      ));
      toast({
        title: 'Success',
        description: 'Sample questionnaire updated',
        status: 'success',
        duration: 3000,
      });
    } else {
      // Save to database
      await saveQuestionnaire(data);
    }
    
    setIsDrawerOpen(false);
    setEditForm(defaultQuestionnaire());
    setEditingIndex(null);
  };

  // Preview (for now, just alert JSON)
  const handlePreview = (idx: number) => {
    alert(JSON.stringify(questionnaires[idx], null, 2));
  };

  // Fetch responses from Supabase or sample data
  const fetchResponses = async (questionnaireId: string) => {
    setLoadingResponses(true);
    try {
      // Check if this is a sample questionnaire (string ID without hyphens)
      if (typeof questionnaireId === 'string' && !questionnaireId.includes('-')) {
        // Use sample responses
        const sampleData = sampleResponses[questionnaireId] || [];
        setResponses(sampleData);
      } else {
        // Fetch from database
        const { data, error } = await supabaseAdmin
          .from('questionnaire_responses')
          .select('*')
          .eq('questionnaire_id', questionnaireId)
          .order('submitted_at', { ascending: false });

        if (error) {
          console.error('Error fetching responses:', error);
          toast({
            title: 'Error',
            description: 'Failed to load responses',
            status: 'error',
            duration: 3000,
          });
        } else {
          setResponses(data || []);
        }
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoadingResponses(false);
    }
  };

  // Fetch detailed analytics
  const fetchDetailedAnalytics = async (questionnaireId: string) => {
    setLoadingAnalytics(true);
    try {
      // Check if this is a sample questionnaire
      if (typeof questionnaireId === 'string' && !questionnaireId.includes('-')) {
        // Use sample data for analytics
        const sampleData = sampleResponses[questionnaireId] || [];
        const totalResponses = sampleData.length;
        
        setAnalyticsData({
          totalResponses,
          totalViews: totalResponses + Math.floor(Math.random() * 5), // Mock data
          totalStarts: totalResponses + Math.floor(Math.random() * 3),
          totalCompletions: totalResponses,
          responseRate: 85 + Math.floor(Math.random() * 15),
          completionRate: 90 + Math.floor(Math.random() * 10),
          avgCompletionTime: 120 + Math.floor(Math.random() * 60),
          dailyData: {},
          recentResponses: sampleData.slice(0, 5),
        });
      } else {
        // Calculate date range
        const now = new Date();
        let startDate = new Date();
        switch (dateRange) {
          case '1d':
            startDate.setDate(now.getDate() - 1);
            break;
          case '7d':
            startDate.setDate(now.getDate() - 7);
            break;
          case '30d':
            startDate.setDate(now.getDate() - 30);
            break;
          case '90d':
            startDate.setDate(now.getDate() - 90);
            break;
          default:
            startDate.setDate(now.getDate() - 7);
        }

        // Fetch responses
        const { data: responses, error: responsesError } = await supabaseAdmin
          .from('questionnaire_responses')
          .select('*')
          .eq('questionnaire_id', questionnaireId)
          .gte('submitted_at', startDate.toISOString())
          .order('submitted_at', { ascending: false });

        // Fetch analytics events
        const { data: events, error: eventsError } = await supabaseAdmin
          .from('questionnaire_analytics')
          .select('*')
          .eq('questionnaire_id', questionnaireId)
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false });

        if (responsesError || eventsError) {
          console.error('Error fetching analytics:', responsesError || eventsError);
          return;
        }

        // Calculate metrics
        const totalResponses = responses?.length || 0;
        const totalViews = events?.filter(e => e.event_type === 'view').length || 0;
        const totalStarts = events?.filter(e => e.event_type === 'start').length || 0;
        const totalCompletions = events?.filter(e => e.event_type === 'complete').length || 0;
        
        const responseRate = totalViews > 0 ? Math.round((totalResponses / totalViews) * 100) : 0;
        const completionRate = totalStarts > 0 ? Math.round((totalCompletions / totalStarts) * 100) : 0;
        
        const avgCompletionTime = events?.filter(e => e.completion_time)
          .reduce((acc, e) => acc + (e.completion_time || 0), 0) / 
          (events?.filter(e => e.completion_time).length || 1);

        // Group by day for trends
        const dailyData = responses?.reduce((acc: any, response) => {
          const date = new Date(response.submitted_at).toLocaleDateString();
          acc[date] = (acc[date] || 0) + 1;
          return acc;
        }, {}) || {};

        setAnalyticsData({
          totalResponses,
          totalViews,
          totalStarts,
          totalCompletions,
          responseRate,
          completionRate,
          avgCompletionTime: Math.round(avgCompletionTime),
          dailyData,
          recentResponses: responses?.slice(0, 5) || [],
        });
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const handleViewResponses = async (q: any) => {
    setResponseModalQ(q);
    setResponseModalOpen(true);
    await fetchResponses(q.id);
    await fetchDetailedAnalytics(q.id);
  };

  // Generate share link
  const generateShareLink = (questionnaire: any) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/questionnaire/${questionnaire.token || questionnaire.id}`;
  };

  // Handle share
  const handleShare = (q: any) => {
    setShareModalQ(q);
    setShareLink(generateShareLink(q));
    setSharePassword('');
    setShareModalOpen(true);
  };

  // Copy link to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
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

  // Update questionnaire with password protection
  const updateQuestionnaireAccess = async (questionnaireId: string, password: string) => {
    try {
      const { error } = await supabase
        .from('questionnaire_templates')
        .update({
          options: {
            password_protected: !!password,
            password: password,
          },
        })
        .eq('id', questionnaireId);

      if (error) throw error;

      toast({
        title: 'Updated',
        description: password ? 'Password protection enabled' : 'Password protection disabled',
        status: 'success',
        duration: 2000,
      });

      await fetchQuestionnaires();
    } catch (err: any) {
      console.error('Error updating questionnaire:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to update questionnaire',
        status: 'error',
        duration: 3000,
      });
    }
  };

  return (
    <AdminLayout>
      <Box p={4} minH="100vh" bg="#353535" color="#ECEDE8" fontFamily="Montserrat, sans-serif">
        <Box position="relative" ml={10} mr={10} zIndex={1} pt={28}>
          <Heading mb={6} fontFamily="'Montserrat', sans-serif" color="#a59480">
            Questionnaire Templates
          </Heading>
          <VStack align="start" spacing={6}>
            <HStack spacing={4}>
              <Text fontWeight="bold">Notification Phone:</Text>
              <Input
                value={notificationPhone}
                onChange={e => setNotificationPhone(e.target.value)}
                placeholder="Enter phone number for notifications"
                width="250px"
                bg="white"
                color="#353535"
                borderRadius="md"
                fontFamily="Montserrat, sans-serif"
              />
              <Button colorScheme="blue" onClick={handleSavePhone}>Save</Button>
            </HStack>
            <Button colorScheme="green" fontFamily="'Montserrat', sans-serif" onClick={handleCreate}>
              + Create Questionnaire
            </Button>
            <QuestionnaireEditDrawer
              isOpen={isDrawerOpen}
              onClose={() => setIsDrawerOpen(false)}
              questionnaire={editForm}
              onSave={handleSaveDrawer}
            />
            {loading ? (
              <Text>Loading questionnaires...</Text>
            ) : (
              <Box mt={8} w="100%" bg="#ecede8" color="#353535" borderRadius="lg" p={6}>
                <Text fontWeight="bold" mb={4} fontFamily="Montserrat, sans-serif">Questionnaires</Text>
                <Table variant="simple" fontFamily="Montserrat, sans-serif">
                  <Thead>
                    <Tr>
                      <Th>Name</Th>
                      <Th>Status</Th>
                      <Th># Questions</Th>
                      <Th>Last Updated</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {questionnaires.map((q, idx) => (
                      <Tr key={q.id || idx}>
                        <Td>{q.name}</Td>
                        <Td>
                          <Switch isChecked={q.is_active} onChange={() => handleToggleActive(idx)} colorScheme="green" />
                          <Text as="span" ml={2}>{q.is_active ? 'Active' : 'Inactive'}</Text>
                        </Td>
                        <Td>{q.questions.length}</Td>
                        <Td>{new Date(q.updated_at || q.last_updated || Date.now()).toLocaleString()}</Td>
                        <Td>
                          <HStack spacing={1}>
                            <IconButton aria-label="Preview" icon={<ViewIcon />} size="sm" onClick={() => handlePreview(idx)} />
                            <IconButton aria-label="Share" icon={<LinkIcon />} size="sm" onClick={() => handleShare(q)} />
                            <IconButton aria-label="Edit" icon={<EditIcon />} size="sm" onClick={() => handleEdit(idx)} />
                            <IconButton aria-label="Duplicate" icon={<CopyIcon />} size="sm" onClick={() => handleDuplicate(idx)} />
                            <IconButton aria-label="Delete" icon={<DeleteIcon />} size="sm" onClick={() => handleDelete(idx)} />
                            <IconButton aria-label="View Responses" icon={<CheckCircleIcon />} size="sm" onClick={() => handleViewResponses(q)} />
                          </HStack>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            )}
          </VStack>
        </Box>
      </Box>

      {/* Response Review Drawer */}
      <Drawer
        isOpen={responseModalOpen}
        placement="right"
        onClose={() => setResponseModalOpen(false)}
        size="lg"
        closeOnOverlayClick={true}
        closeOnEsc={true}
      >
        <Box zIndex="2000" position="relative">
          <DrawerOverlay bg="blackAlpha.600" onClick={() => setResponseModalOpen(false)} />
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
            height="100vh"
            style={{
              transform: responseModalOpen ? 'translateX(0)' : 'translateX(100%)',
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
              Responses for: {responseModalQ?.name}
            </DrawerHeader>
            
            <DrawerBody 
              p={4} 
              overflowY="auto" 
              fontFamily="Montserrat, sans-serif" 
              maxHeight="calc(100vh - 120px)"
            >
              {!responseModalQ ? null : (
                <>
                  {/* Analytics Section */}
                  <Box mb={6} p={4} bg="#f8f9fa" borderRadius="md">
                    <HStack justify="space-between" mb={3}>
                      <Text fontWeight="bold" fontFamily="Montserrat, sans-serif">Analytics</Text>
                      <Select
                        size="sm"
                        value={dateRange}
                        onChange={(e) => {
                          setDateRange(e.target.value);
                          if (responseModalQ) {
                            fetchDetailedAnalytics(responseModalQ.id);
                          }
                        }}
                        width="120px"
                      >
                        <option value="1d">Last 24h</option>
                        <option value="7d">Last 7 days</option>
                        <option value="30d">Last 30 days</option>
                        <option value="90d">Last 90 days</option>
                      </Select>
                    </HStack>
                    
                    {loadingAnalytics ? (
                      <Text>Loading analytics...</Text>
                    ) : (
                      <VStack align="stretch" spacing={4}>
                        <SimpleGrid columns={2} spacing={4}>
                          <Stat>
                            <StatLabel>Total Responses</StatLabel>
                            <StatNumber>{analyticsData.totalResponses}</StatNumber>
                            <StatHelpText>In selected period</StatHelpText>
                          </Stat>
                          <Stat>
                            <StatLabel>Response Rate</StatLabel>
                            <StatNumber>{analyticsData.responseRate}%</StatNumber>
                            <StatHelpText>Views to responses</StatHelpText>
                          </Stat>
                          <Stat>
                            <StatLabel>Completion Rate</StatLabel>
                            <StatNumber>{analyticsData.completionRate}%</StatNumber>
                            <StatHelpText>Starts to completions</StatHelpText>
                          </Stat>
                          <Stat>
                            <StatLabel>Avg. Time</StatLabel>
                            <StatNumber>{analyticsData.avgCompletionTime}s</StatNumber>
                            <StatHelpText>To complete form</StatHelpText>
                          </Stat>
                        </SimpleGrid>
                        
                        <Box>
                          <Text fontWeight="semibold" mb={2}>Traffic Overview</Text>
                          <SimpleGrid columns={3} spacing={2}>
                            <Box textAlign="center" p={2} bg="white" borderRadius="md">
                              <Text fontSize="lg" fontWeight="bold" color="blue.500">{analyticsData.totalViews}</Text>
                              <Text fontSize="sm">Views</Text>
                            </Box>
                            <Box textAlign="center" p={2} bg="white" borderRadius="md">
                              <Text fontSize="lg" fontWeight="bold" color="orange.500">{analyticsData.totalStarts}</Text>
                              <Text fontSize="sm">Started</Text>
                            </Box>
                            <Box textAlign="center" p={2} bg="white" borderRadius="md">
                              <Text fontSize="lg" fontWeight="bold" color="green.500">{analyticsData.totalCompletions}</Text>
                              <Text fontSize="sm">Completed</Text>
                            </Box>
                          </SimpleGrid>
                        </Box>
                        
                        {analyticsData.recentResponses && analyticsData.recentResponses.length > 0 && (
                          <Box>
                            <Text fontWeight="semibold" mb={2}>Recent Responses</Text>
                            <VStack align="stretch" spacing={2}>
                              {analyticsData.recentResponses.map((resp: any, idx: number) => (
                                <Box key={resp.id} p={2} bg="white" borderRadius="md" fontSize="sm">
                                  <HStack justify="space-between">
                                    <Text>Response #{idx + 1}</Text>
                                    <Badge colorScheme="green">{new Date(resp.submitted_at).toLocaleDateString()}</Badge>
                                  </HStack>
                                </Box>
                              ))}
                            </VStack>
                          </Box>
                        )}
                      </VStack>
                    )}
                  </Box>

                  {/* Responses Section */}
                  {loadingResponses ? (
                    <Text>Loading responses...</Text>
                  ) : responses.length === 0 ? (
                    <Text>No responses yet.</Text>
                  ) : (
                    <VStack align="stretch" spacing={4}>
                      {responses.map((resp, i) => (
                        <Box key={resp.id} p={3} borderWidth={1} borderRadius="md" bg="#f7f7f2">
                          <Text fontWeight="bold">Response #{i + 1}</Text>
                          <Text fontSize="sm" color="gray.600">
                            Submitted: {new Date(resp.submitted_at || resp.meta?.submittedAt || Date.now()).toLocaleString()}
                          </Text>
                          {resp.member_id && (
                            <Text fontSize="sm" color="gray.600">
                              Member ID: {resp.member_id}
                            </Text>
                          )}
                          {Object.entries(resp.answers || {}).map(([qid, ans]) => (
                            <Box key={qid} mt={2}>
                              <Text as="span" fontWeight="semibold">{qid}: </Text>
                              {typeof ans === 'string' && (ans.startsWith('http') || ans.startsWith('data:image')) ? (
                                <img src={ans} alt="Uploaded" style={{ maxWidth: 120, display: 'block', marginTop: 4 }} />
                              ) : (
                                <Text as="span">{String(ans)}</Text>
                              )}
                            </Box>
                          ))}
                          {resp.files && Object.entries(resp.files).map(([qid, file]) => (
                            <Box key={`file-${qid}`} mt={2}>
                              <Text as="span" fontWeight="semibold">File {qid}: </Text>
                              {typeof file === 'string' && (file.startsWith('http') || file.startsWith('data:image')) ? (
                                <img src={file} alt="Uploaded" style={{ maxWidth: 120, display: 'block', marginTop: 4 }} />
                              ) : (
                                <Text as="span">File uploaded</Text>
                              )}
                            </Box>
                          ))}
                          {resp.signatures && Object.entries(resp.signatures).map(([qid, sig]) => (
                            <Box key={`sig-${qid}`} mt={2}>
                              <Text as="span" fontWeight="semibold">Signature {qid}: </Text>
                              {typeof sig === 'string' && sig.startsWith('data:image') ? (
                                <img src={sig} alt="Signature" style={{ maxWidth: 120, display: 'block', marginTop: 4 }} />
                              ) : (
                                <Text as="span">Signature provided</Text>
                              )}
                            </Box>
                          ))}
                        </Box>
                      ))}
                    </VStack>
                  )}
                </>
              )}
            </DrawerBody>
            
            <DrawerFooter 
              borderTopWidth="1px" 
              position="sticky" 
              bottom="0" 
              bg="#ecede8"
              zIndex="1"
            >
              <Button onClick={() => setResponseModalOpen(false)}>Close</Button>
            </DrawerFooter>
          </DrawerContent>
        </Box>
      </Drawer>

      {/* Share Drawer */}
      <Drawer
        isOpen={shareModalOpen}
        placement="right"
        onClose={() => setShareModalOpen(false)}
        size="lg"
        closeOnOverlayClick={true}
        closeOnEsc={true}
      >
        <Box zIndex="2000" position="relative">
          <DrawerOverlay bg="blackAlpha.600" onClick={() => setShareModalOpen(false)} />
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
            height="100vh"
            style={{
              transform: shareModalOpen ? 'translateX(0)' : 'translateX(100%)',
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
              Share Questionnaire: {shareModalQ?.name}
            </DrawerHeader>
            
            <DrawerBody 
              p={4} 
              overflowY="auto" 
              fontFamily="Montserrat, sans-serif" 
              maxHeight="calc(100vh - 120px)"
            >
              <VStack align="stretch" spacing={4}>
                <Box>
                  <Text fontWeight="semibold" mb={2}>Public Link</Text>
                  <HStack>
                    <Input value={shareLink} isReadOnly fontFamily="monospace" fontSize="sm" />
                    <IconButton
                      aria-label="Copy link"
                      icon={<CopyIcon />}
                      onClick={() => copyToClipboard(shareLink)}
                      size="sm"
                    />
                    <IconButton
                      aria-label="Open link"
                      icon={<ExternalLinkIcon />}
                      onClick={() => window.open(shareLink, '_blank')}
                      size="sm"
                    />
                  </HStack>
                </Box>
                
                <Box>
                  <Text fontWeight="semibold" mb={2}>Password Protection (Optional)</Text>
                  <Text fontSize="sm" color="gray.600" mb={2}>
                    Require a password to access this questionnaire
                  </Text>
                  <Input
                    placeholder="Enter password (leave empty to disable)"
                    value={sharePassword}
                    onChange={(e) => setSharePassword(e.target.value)}
                    type="password"
                  />
                </Box>
                
                <Box p={3} bg="blue.50" borderRadius="md">
                  <Text fontSize="sm" fontWeight="semibold" mb={1}>Sharing Options:</Text>
                  <Text fontSize="sm">• Public Link: Anyone with the link can access</Text>
                  <Text fontSize="sm">• Password Protected: Requires password to view</Text>
                  <Text fontSize="sm">• Embed: Can be embedded in other websites</Text>
                </Box>
              </VStack>
            </DrawerBody>
            
            <DrawerFooter 
              borderTopWidth="1px" 
              position="sticky" 
              bottom="0" 
              bg="#ecede8"
              zIndex="1"
            >
              <HStack spacing={3} width="100%" justify="space-between">
                <Button 
                  onClick={() => setShareModalOpen(false)} 
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button 
                  colorScheme="blue" 
                  onClick={() => {
                    if (shareModalQ?.id) {
                      updateQuestionnaireAccess(shareModalQ.id, sharePassword);
                    }
                    setShareModalOpen(false);
                  }}
                >
                  Save Settings
                </Button>
              </HStack>
            </DrawerFooter>
          </DrawerContent>
        </Box>
      </Drawer>
    </AdminLayout>
  );
};

export default QuestionnaireAdminPage; 