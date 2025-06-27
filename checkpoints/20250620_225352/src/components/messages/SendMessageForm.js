import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Select,
  Textarea,
  Text,
  VStack,
  useToast,
  Heading,
} from '@chakra-ui/react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const TEMPLATES = [
  {
    label: 'Payment Reminder',
    value: 'payment_reminder',
    text: 'Hi {{first_name}}, this is a reminder that your membership payment is due. Please let us know if you have any questions.'
  },
  {
    label: 'Welcome',
    value: 'welcome',
    text: "Welcome to Noir! We're excited to have you as a member. Let us know if you need anything."
  },
  {
    label: 'Custom',
    value: 'custom',
    text: ''
  }
];

export default function SendMessageForm({ members = [], accountId, onSent }) {
  const [template, setTemplate] = useState(TEMPLATES[0].value);
  const [message, setMessage] = useState(TEMPLATES[0].text.replace('{{first_name}}', members[0]?.first_name || ''));
  const [sending, setSending] = useState(false);
  const [recipient, setRecipient] = useState('all');
  const toast = useToast();

  const handleTemplateChange = (e) => {
    const selected = TEMPLATES.find(t => t.value === e.target.value);
    setTemplate(selected.value);
    setMessage(selected.text.replace('{{first_name}}', members[0]?.first_name || ''));
  };

  const handleSend = async () => {
    setSending(true);
    let member_ids = [];
    if (recipient === 'all') {
      member_ids = members.map(m => String(m.member_id));
    } else {
      member_ids = [String(recipient)];
    }

    if (!member_ids.length || !message.trim()) {
      toast({
        title: 'Error',
        description: 'Recipient(s) and message content are required.',
        status: 'error',
        duration: 3000,
      });
      setSending(false);
      return;
    }

    try {
      // Get the current user's session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw new Error('Failed to get user session');
      }

      const userEmail = session?.user?.email;
      if (!userEmail) {
        throw new Error('User email not found in session');
      }

      const res = await fetch('/api/sendText', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-email': userEmail
        },
        body: JSON.stringify({
          member_ids,
          content: message,
          account_id: accountId
        })
      });

      const result = await res.json();

      if (res.ok && result.results && result.results.every(r => r.status === 'sent')) {
        toast({
          title: 'Success',
          description: 'Message sent successfully!',
          status: 'success',
          duration: 3000,
        });
        if (onSent) onSent();
        setMessage(TEMPLATES[0].text.replace('{{first_name}}', members[0]?.first_name || ''));
        setTemplate(TEMPLATES[0].value);
        setRecipient('all');
      } else {
        toast({
          title: 'Error',
          description: result.results?.[0]?.error || 'Failed to send message',
          status: 'error',
          duration: 3000,
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err.message,
        status: 'error',
        duration: 3000,
      });
    }
    setSending(false);
  };

  return (
    <Box 
      bg="#ecede8" 
      p={8} 
      borderRadius="16px" 
      boxShadow="0 4px 16px rgba(53,53,53,0.5)"
      fontFamily="Montserrat, sans-serif"
    >
      <VStack spacing={6} align="center">
        <Heading 
          size="md" 
          color="#353535" 
          fontFamily="IvyJournal-Thin, serif" 
          textTransform="uppercase" 
          letterSpacing="0.08em"
          mb={4}
          textAlign="center"
        >
          Send Message
        </Heading>
        
        <FormControl w="400px">
          <FormLabel align="left" color="#353535" fontWeight="semibold" fontFamily="Montserrat, sans-serif" fontSize="md" mb={2}>To:</FormLabel>
          <Select
            value={recipient}
            onChange={e => setRecipient(e.target.value)}
            w="100%"
            bg="white"
            borderRadius="12px"
            align="left"
            border="2px solid"
            borderColor="gray.300"
            _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
            fontFamily="Montserrat, sans-serif"
            icon={<></>}
            size="md"
            height="48px"
            fontSize="16px"
            px={4}
          >
            <option value="all">All Members</option>
            {members.map(m => (
              <option key={m.member_id} value={m.member_id}>
                {m.first_name} {m.last_name} {m.phone ? `(${m.phone})` : ''}
              </option>
            ))}
          </Select>
        </FormControl>

        <FormControl w="400px">
          <FormLabel align="left" color="#353535" fontWeight="semibold" fontFamily="Montserrat, sans-serif" fontSize="md" mb={2}>Template:</FormLabel>
          <Select 
            value={template} 
            onChange={handleTemplateChange}
            w="100%"
            bg="white"
            borderRadius="12px"
            border="2px solid"
            borderColor="gray.300"
            _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
            fontFamily="Montserrat, sans-serif"
            icon={<></>}
            size="md"
            height="48px"
            fontSize="16px"
            px={4}
          >
            {TEMPLATES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
        </FormControl>

        <FormControl w="400px">
          <FormLabel align="left" color="#353535" fontWeight="semibold" fontFamily="Montserrat, sans-serif" fontSize="md" mb={2}>Message:</FormLabel>
          <Textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            w="100%"
            rows={6}
            bg="white"
            borderRadius="12px"
            border="2px solid"
            borderColor="gray.300"
            _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
            fontFamily="Montserrat, sans-serif"
            resize="vertical"
            size="md"
            fontSize="16px"
            px={4}
            py={3}
            minH="120px"
          />
        </FormControl>

        <Button
          bg="#353535"
          color="#ecede8"
          _hover={{ bg: '#2a2a2a' }}
          onClick={handleSend}
          isLoading={sending}
          isDisabled={!message.trim() || (recipient !== 'all' && !recipient)}
          borderRadius="12px"
          px={8}
          py={4}
          fontFamily="Montserrat, sans-serif"
          fontWeight="semibold"
          fontSize="16px"
          height="56px"
          mt={4}
          w="400px"
        >
          {sending ? 'Sending...' : 'Send Message'}
        </Button>
      </VStack>
    </Box>
  );
} 