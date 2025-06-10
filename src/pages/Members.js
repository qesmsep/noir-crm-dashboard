import { useEffect, useState } from "react";
import { Box, Text, Spinner, Heading, Input, Button, VStack, HStack, Image } from "@chakra-ui/react";
import { supabase } from "../api/supabaseClient";

export default function Members() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lookupQuery, setLookupQuery] = useState("");

  useEffect(() => {
    async function fetchMembers() {
      console.log('Fetching members...');
      try {
        const { data, error } = await supabase
          .from('members')
          .select('*')
          .order('join_date', { ascending: false });

        console.log('Supabase response:', { data, error });

        if (error) throw error;
        setMembers(data || []);
      } catch (err) {
        console.error('Error fetching members:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchMembers();
  }, []);

  const formatDateLong = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatPhone = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return '(' + match[1] + ') ' + match[2] + '-' + match[3];
    }
    return phone;
  };

  const filteredMembers = members.filter(member => {
    const searchStr = lookupQuery.toLowerCase();
    return (
      member.first_name?.toLowerCase().includes(searchStr) ||
      member.last_name?.toLowerCase().includes(searchStr) ||
      member.email?.toLowerCase().includes(searchStr) ||
      member.phone?.includes(searchStr)
    );
  });

  if (loading) {
    return (
      <Box p={8} display="flex" justifyContent="center">
        <Spinner size="xl" />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={8}>
        <Text color="red.500">Error loading members: {error}</Text>
      </Box>
    );
  }

  return (
    <Box p={8}>
      <VStack spacing={6} align="stretch">
        <HStack justify="space-between" align="center">
          <Heading>Members</Heading>
          <Button colorScheme="blue">Add New Member</Button>
        </HStack>

        <Input
          placeholder="Search by name, email, or phone"
          value={lookupQuery}
          onChange={(e) => setLookupQuery(e.target.value)}
          size="lg"
          mb={4}
        />

        {filteredMembers.length === 0 ? (
          <Text>No members found</Text>
        ) : (
          <VStack spacing={4} align="stretch">
            {filteredMembers.map((member) => (
              <Box
                key={member.member_id}
                p={6}
                bg="white"
                borderRadius="lg"
                boxShadow="sm"
                border="1px"
                borderColor="gray.200"
                _hover={{ boxShadow: "md" }}
                transition="all 0.2s"
              >
                <HStack spacing={6} align="start">
                  {member.photo ? (
                    <Image
                      src={member.photo}
                      alt={`${member.first_name} ${member.last_name}`}
                      boxSize="100px"
                      borderRadius="full"
                      objectFit="cover"
                    />
                  ) : (
                    <Box
                      boxSize="100px"
                      borderRadius="full"
                      bg="gray.100"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Text fontSize="2xl" color="gray.500">
                        {member.first_name?.[0]}{member.last_name?.[0]}
                      </Text>
                    </Box>
                  )}
                  <VStack align="start" spacing={2} flex={1}>
                    <Text fontSize="xl" fontWeight="bold">
                      {member.first_name} {member.last_name}
                    </Text>
                    <Text>Member since: {formatDateLong(member.join_date)}</Text>
                    <Text>Phone: {formatPhone(member.phone)}</Text>
                    <Text>Email: {member.email}</Text>
                    {member.dob && <Text>Date of Birth: {formatDateLong(member.dob)}</Text>}
                    {member.membership && (
                      <Text color="blue.600" fontWeight="medium">
                        {member.membership}
                      </Text>
                    )}
                  </VStack>
                </HStack>
              </Box>
            ))}
          </VStack>
        )}
      </VStack>
    </Box>
  );
} 