import React, { useEffect, useState } from 'react';
import { getSupabaseClient } from '../pages/api/supabaseClient';
import {
  Box,
  Button,
  Flex,
  Heading,
  Text,
  Input,
  Select,
  Spinner,
  VStack,
  HStack,
  useToast,
} from '@chakra-ui/react';

interface PrivateEventBookingProps {
  eventId: string;
  rsvpMode?: boolean;
}

interface EventData {
  id: string;
  title: string;
  event_type?: string;
  start_time: string;
  end_time: string;
}

interface FormState {
  name: string;
  phone: string;
  email: string;
  party_size: number;
  preferred_time: string;
}

const PrivateEventBooking: React.FC<PrivateEventBookingProps> = ({ eventId, rsvpMode }) => {
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<FormState>({
    name: '',
    phone: '',
    email: '',
    party_size: 1,
    preferred_time: '',
  });
  const [status, setStatus] = useState('');
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const toast = useToast();

  const supabase = getSupabaseClient();

  useEffect(() => {
    async function fetchEvent() {
      setLoading(true);
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();
      if (error || !data) {
        setError('Event not found.');
      } else {
        setEvent(data);
        if (data.start_time && data.end_time) {
          const times = generateTimeSlots(data.start_time, data.end_time);
          setAvailableTimes(times);
          setForm(f => ({ ...f, preferred_time: times[0] }));
        }
      }
      setLoading(false);
    }
    fetchEvent();
  }, [eventId]);

  const generateTimeSlots = (startTime: string, endTime: string) => {
    const slots: string[] = [];
    const start = new Date(startTime);
    const end = new Date(endTime);
    const current = new Date(start);
    while (current < end) {
      slots.push(current.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
      current.setMinutes(current.getMinutes() + 15);
    }
    return slots;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('');
    if (!form.name || !form.phone || !form.email || !form.party_size || !form.preferred_time) {
      setStatus('Please fill all fields.');
      return;
    }
    const res = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        start_time: event?.start_time,
        end_time: event?.end_time,
        event_id: event?.id,
        source: 'private_event_link',
      })
    });
    if (res.ok) {
      setStatus('Reservation confirmed!');
      setForm({ name: '', phone: '', email: '', party_size: 1, preferred_time: availableTimes[0] });
      toast({ title: 'Reservation confirmed!', status: 'success', duration: 3000 });
    } else {
      const data = await res.json();
      setStatus(data.error || 'Failed to reserve.');
      toast({ title: 'Failed to reserve.', status: 'error', duration: 3000 });
    }
  };

  if (loading) return <Flex py={10} color="gray.500" justify="center"><Spinner mr={3} />Loading event...</Flex>;
  if (error) return <Box py={10} color="red.500" fontWeight={600} textAlign="center">{error}</Box>;

  return (
    <Box maxW="md" mx="auto" p={6} bg="white" borderRadius="lg" boxShadow="md">
      <Heading as="h2" size="lg" mb={2} color="gray.700">{event?.title || 'Private Event'}</Heading>
      <Text color="gray.600" mb={4} fontSize="md">
        {event?.event_type && <span style={{ marginRight: 8, color: '#a59480' }}>{event.event_type}</span>}
        {event?.start_time && new Date(event.start_time).toLocaleDateString()}<br />
        {event?.start_time && event?.end_time && (
          <>{new Date(event.start_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - {new Date(event.end_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</>
        )}
      </Text>
      <form onSubmit={handleSubmit}>
        <VStack spacing={4} align="stretch">
          <Box>
            <Text fontWeight={500} mb={1}>Full Name</Text>
            <Input name="name" placeholder="Full Name" value={form.name} onChange={handleChange} required />
          </Box>
          <Box>
            <Text fontWeight={500} mb={1}>Phone</Text>
            <Input name="phone" placeholder="Phone" value={form.phone} onChange={handleChange} required />
          </Box>
          <Box>
            <Text fontWeight={500} mb={1}>Email</Text>
            <Input name="email" placeholder="Email" value={form.email} onChange={handleChange} required />
          </Box>
          <Box>
            <Text fontWeight={500} mb={1}>Party Size</Text>
            <HStack>
              <Button type="button" onClick={() => setForm(f => ({ ...f, party_size: Math.max(1, Number(f.party_size) - 1) }))} size="sm">-</Button>
              <Text fontSize="lg" minW="60px" textAlign="center">{form.party_size}</Text>
              <Button type="button" onClick={() => setForm(f => ({ ...f, party_size: Number(f.party_size) + 1 }))} size="sm">+</Button>
            </HStack>
          </Box>
          <Box>
            <Text fontWeight={500} mb={1}>Preferred Arrival Time</Text>
            <Select name="preferred_time" value={form.preferred_time} onChange={handleChange} required>
              {availableTimes.map(time => (
                <option key={time} value={time}>{time}</option>
              ))}
            </Select>
          </Box>
          <Button type="submit" colorScheme="yellow" bg="#a59480" color="white" _hover={{ bg: '#8c7a5a' }} fontWeight={600} width="100%">
            Reserve
          </Button>
          {status && <Text color={status.includes('confirmed') ? 'green.500' : 'red.500'}>{status}</Text>}
        </VStack>
      </form>
    </Box>
  );
};

export default PrivateEventBooking; 