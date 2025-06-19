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
  Button,
  Divider
} from "@chakra-ui/react";
import { PhoneIcon, EmailIcon, CalendarIcon } from "@chakra-ui/icons";
import { useRouter } from "next/router";
import { supabase } from "../api/supabaseClient";
import AdminLayout from '../../components/layouts/AdminLayout';

interface Member {
  member_id: string;
  account_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  photo?: string;
  join_date?: string;
  primary?: boolean;
  dob?: string;
}

export default function MembersAdmin() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lookupQuery, setLookupQuery] = useState("");
  const router = useRouter();

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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const formatDateLong = (date?: string) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatPhone = (phone?: string) => {
    if (!phone) return '';
    // Remove all non-digits, take last 10 digits, and pad start if less than 10
    let cleaned = phone.replace(/\D/g, '').slice(-10);
    if (cleaned.length < 10) {
      cleaned = cleaned.padStart(10, '0');
    }
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
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
  const membersByAccount: { [accountId: string]: Member[] } = filteredMembers.reduce((acc, member) => {
    if (!acc[member.account_id]) acc[member.account_id] = [];
    acc[member.account_id].push(member);
    return acc;
  }, {} as { [accountId: string]: Member[] });

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
    <AdminLayout>
      <Box p={8} bg="#353535" minH="100vh">
        <VStack spacing={8} align="stretch">
          <HStack justify="space-between" align="center" mb={8}>
            <Box flex={1}>
              <Input
                placeholder="Search by name, email, or phone"
                value={lookupQuery}
                onChange={(e) => setLookupQuery(e.target.value)}
                width="100%"
                maxW="600px"
                bg="white"
                color="#353535"
                borderRadius="12px"
                border="1px solid #E2E8F0"
                _focus={{ borderColor: '#A59480', boxShadow: '0 0 0 1px #A59480' }}
                height="48px"
                fontSize="md"
                _placeholder={{ color: '#718096' }}
              />
            </Box>
            <Button    
              bg="#A59480"
              color="white"
              _hover={{ bg: '#8B7B68' }}
              height="48px"
              minW="180px"
              borderRadius="12px"
              fontWeight="semibold"
              fontSize="md"
              transition="all 0.2s"
            >
              Add Member
            </Button>
          </HStack>

          {Object.entries(membersByAccount).length === 0 ? (
            <Box textAlign="center" py={12}>
              <Text fontSize="xl" color="gray.400">No members found</Text>
            </Box>
          ) : (
            <SimpleGrid columns={3} spacing={18}>
              {Object.entries(membersByAccount).map(([accountId, accountMembers]) => (
                <Box 
                  key={accountId}
                  onClick={() => router.push(`/admin/members/${accountId}`)}
                  cursor="pointer"
                  bg="white"
                  border="3px solid #a59480"
                  borderRadius="12px"
                  overflow="hidden"
                  boxShadow="0 8px 32px rgba(0,0,0,0.5)"
                  transition="all 0.2s"
                  height="100%"
                  p={0}
                  _hover={{
                    transform: 'scale(1.01)',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.5)'
                  }}
                ><Box p={1} bg="gray.50" display="flex" justifyContent="flex-end" alignItems="flex-end">
                <Text color="gray.600" fontSize="xs" m="0" pt="10" pr="10" textAlign="right">
                  Member Since {formatDateLong(accountMembers[0].join_date)}
                </Text>
              </Box>
                  <Box
                    color="#353535"
                    display="flex"
                    flexDirection="column"
                    w="100%"
                    h="100%"
                    position="relative"
                    zIndex={1}
                    mt="0"
                    style={{
                      borderRadius: '12px',
                      overflow: 'hidden'
                    }}
                  >
                    <VStack align="flex-start" spacing={14} w="100%" p={14} pb="30">
                      {[...accountMembers]
                        .sort((a, b) => a.primary === b.primary ? 0 : a.primary ? -1 : 1)
                        .map(member => (
                          <Box
                            key={member.member_id}
                            w="100%"
                            bg="#a59480"
                            borderRadius="10px"
                            boxShadow="0 4px 16px rgba(53,53,53,0.5)"
                            p={16}
                            
                            mb={2}
                          >
                            <HStack align="flex-start" spacing={4} w="100%">
                              {member.photo ? (
                                <Box 
                                  style={{
                                    borderRadius: '50%',
                                    overflow: 'hidden',
                                    width: '100px',
                                    height: '100px',
                                    flexShrink: 0,
                                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                                    border: '2px solid #F7FAFC'
                                  }}
                                >
                                  <Image
                                    src={member.photo}
                                    alt={`${member.first_name} ${member.last_name}`}
                                    boxSize="100px"
                                  
                                    objectFit="cover"
                                  />
                                </Box>
                              ) : (
                                <Box
                                  style={{
                                    width: '100px',
                                    height: '100px',
                                    borderRadius: '50%',
                                    backgroundColor: '#F7FAFC',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                                    border: '2px solid #F7FAFC'
                                  }}
                                >
                                  <Text fontSize="3xl" color="#AECEDE8" fontWeight="bold">
                                    {member.first_name?.[0]}{member.last_name?.[0]}
                                  </Text>
                                </Box>
                              )}
                              <VStack align="flex-start" spacing={1} flex={1}>
                                <Text 
                                  fontSize="24px" 
                                  fontWeight="normal" 
                                  color="#ecede8" 
                                  mt="10"
                                  fontFamily="IvyJournalThin, serif"
                                  textTransform="uppercase"
                                  letterSpacing="0.0em"
                                  mb={0}
                                >
                                  {member.first_name} {member.last_name}
                                </Text>
                                <VStack align="flex-start" p="1" spacing={0} color="#353535" w="100%">
                                  <HStack spacing={1} >
                                    <PhoneIcon boxSize={16} />
                                    <Text fontSize="16px" p="0" m="5" fontFamily="Montserrat Regular, sans-serif">{formatPhone(member.phone)}</Text>
                                  </HStack>
                                  <HStack spacing={1}>
                                    <EmailIcon boxSize={16} />
                                    <Text fontSize="16px" p="0" m="5" fontFamily="Montserrat Regular, sans-serif">{member.email}</Text>
                                  </HStack>
                                  
                                </VStack>
                              </VStack>
                            </HStack>
                          </Box>
                        ))}
                    </VStack>
                   
                    
                  </Box>
                </Box>
              ))}
            </SimpleGrid>
          )}
        </VStack>
      </Box>
    </AdminLayout>
  );
}