import { useEffect, useState } from "react";
import {
  Box,
  Heading,
  Spinner,
  Text,
  VStack,
  HStack,
  SimpleGrid,
  Image,
  Input,
  Button
} from "@chakra-ui/react";
import { CalendarIcon, PhoneIcon, EmailIcon, InfoIcon } from "@chakra-ui/icons";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../api/supabaseClient";

export default function MembersAdmin() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lookupQuery, setLookupQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchMembers();
  }, []);

  async function fetchMembers() {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('join_date', { ascending: false });
      if (error) throw error;
      setMembers(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

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

  // Group members by account_id
  const membersByAccount = filteredMembers.reduce((acc, member) => {
    if (!acc[member.account_id]) acc[member.account_id] = [];
    acc[member.account_id].push(member);
    return acc;
  }, {});

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
          <Heading>Members Administration</Heading>
          <Button colorScheme="blue">Add Member</Button>
        </HStack>
        <Input
          placeholder="Search by name, email, or phone"
          value={lookupQuery}
          onChange={(e) => setLookupQuery(e.target.value)}
          size="lg"
          mb={4}
        />
        {Object.entries(membersByAccount).length === 0 ? (
          <Text>No members found</Text>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
          {Object.entries(membersByAccount).map(([accountId, accountMembers]) => (
            <Box
              key={accountId}
              p={4}
              bg="nightSky"
              color="weddingDay"
              borderRadius="md"
              borderWidth="1px"
              borderColor="weddingDay"
              boxShadow="lg"
              display="flex"
              flexDirection="column"
              justifyContent="space-between"
              h="100%"
              _hover={{
                boxShadow: "2xl",
                transform: "scale(1.02)"
              }}
              transition="transform 0.2s, box-shadow 0.2s"
              cursor="pointer"
              onClick={() => navigate(`/admin/members/${accountId}`)}
            >
              
        
              <VStack spacing={6} align="start">
                {[...accountMembers]
                  .sort((a, b) => a.primary === b.primary ? 0 : a.primary ? -1 : 1)
                  .map(member => (
                    <HStack key={member.member_id} spacing={4} align="start">
                      {/* Photo */}
                      {member.photo ? (
                        <Image
                          src={member.photo}
                          alt={`${member.first_name} ${member.last_name}`}
                          boxSize="100px"
                          borderRadius="full"
                          borderWidth="2px"
                          borderColor="weddingDay"
                          boxShadow="2xl"
                          objectFit="cover"
                        />
                      ) : (
                        <Box
                          boxSize="100px"
                          borderRadius="full"
                          borderWidth="2px"
                          borderColor="weddingDay"
                          boxShadow="2xl"
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
        
                      {/* Member info */}
                      <VStack align="start" spacing={1}>
                        <Text
                          fontSize="xl"
                          fontWeight="bold"
                          fontFamily="CONEBAR"
                          textTransform="uppercase"
                        >
                          {member.first_name} {member.last_name}
                        </Text>
                        <HStack spacing={2}>
                          <PhoneIcon />
                          <Text fontFamily="Montserrat-Light" fontSize="sm">
                            {formatPhone(member.phone)}
                          </Text>
                        </HStack>
                        <HStack spacing={2}>
                          <EmailIcon />
                          <Text fontFamily="Montserrat-Light" fontSize="sm">
                            {member.email}
                          </Text>
                        </HStack>
                      </VStack>
                    </HStack>
                ))}
              </VStack>
              <Text fontFamily="Montserrat-Light" fontSize="sm" alignSelf="flex-end" mt={4}>
        Member Since {formatDateLong(accountMembers[0].join_date)}
      </Text>
            </Box>
          ))}
        </SimpleGrid>
        )}
      </VStack>
    </Box>
  );
} 