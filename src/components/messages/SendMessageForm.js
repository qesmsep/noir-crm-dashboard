import React, { useState } from 'react';
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
} from '@chakra-ui/react';

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
      const res = await fetch('/api/sendText', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    <Box bg="white" p={6} borderRadius="lg" boxShadow="sm">
      <VStack spacing={4} align="stretch">
        <FormControl>
          <FormLabel>To:</FormLabel>
          <Select
            value={recipient}
            onChange={e => setRecipient(e.target.value)}
            bg="white"
          >
            <option value="all">All Members</option>
            {members.map(m => (
              <option key={m.member_id} value={m.member_id}>
                {m.first_name} {m.last_name} {m.phone ? `(${m.phone})` : ''}
              </option>
            ))}
          </Select>
        </FormControl>

        <FormControl>
          <FormLabel>Template:</FormLabel>
          <Select 
            value={template} 
            onChange={handleTemplateChange}
            bg="white"
          >
            {TEMPLATES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
        </FormControl>

        <FormControl>
          <FormLabel>Message:</FormLabel>
          <Textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={5}
            bg="white"
          />
        </FormControl>

        <Button
          colorScheme="blue"
          onClick={handleSend}
          isLoading={sending}
          isDisabled={!message.trim() || (recipient !== 'all' && !recipient)}
        >
          {sending ? 'Sending...' : 'Send Message'}
        </Button>
      </VStack>
    </Box>
  );
} 