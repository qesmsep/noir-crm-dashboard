import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import {
  Box,
  Container,
  Grid,
  GridItem,
  VStack,
  HStack,
  Text,
  Heading,
  Button,
  Avatar,
  Card,
  CardBody,
  CardHeader,
  Badge,
  Divider,
  useToast,
  Skeleton,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  useDisclosure,
} from '@chakra-ui/react';
import {
  EditIcon,
  SettingsIcon,
  CalendarIcon,
  ChevronDownIcon,
} from '@chakra-ui/icons';
import { FiUser, FiDollarSign, FiLogOut } from 'react-icons/fi';
import { useAuth } from '../../lib/auth';
import MemberProfileModal from '../../components/member-portal/MemberProfileModal';
import MemberLedger from '../../components/member-portal/MemberLedger';
import MemberBilling from '../../components/member-portal/MemberBilling';

interface Member {
  member_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  photo_url?: string;
  join_date: string;
  membership_type: string;
  membership_status: string;
  preferences: any;
  balance?: number;
}

interface LedgerEntry {
  id: string;
  transaction_type: string;
  amount: number;
  description: string;
  transaction_date: string;
  balance_after: number;
  reference_id?: string;
}

type ActiveTab = 'overview' | 'profile' | 'ledger' | 'billing' | 'reservations';

export default function MemberPortal() {
  const [member, setMember] = useState<Member | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [pendingChanges, setPendingChanges] = useState([]);
  
  const { user, signOut } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { isOpen: isProfileOpen, onOpen: onProfileOpen, onClose: onProfileClose } = useDisclosure();

  useEffect(() => {
    if (!user) {
      router.push('/auth/member-login');
      return;
    }
    fetchMemberData();
    fetchLedgerData();
    fetchPendingChanges();
  }, [user]);

  const fetchMemberData = async () => {
    try {
      const response = await fetch('/api/member-portal/profile');
      const data = await response.json();
      
      if (data.success) {
        setMember(data.member);
      } else {
        toast({
          title: 'Error loading profile',
          description: 'Please try refreshing the page',
          status: 'error',
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('Error fetching member data:', error);
      toast({
        title: 'Connection error',
        description: 'Unable to load your profile',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const fetchLedgerData = async () => {
    try {
      const response = await fetch('/api/member-portal/ledger');
      const data = await response.json();
      
      if (data.success) {
        setLedgerEntries(data.entries);
      }
    } catch (error) {
      console.error('Error fetching ledger data:', error);
    }
  };

  const fetchPendingChanges = async () => {
    try {
      const response = await fetch('/api/member-portal/pending-changes');
      const data = await response.json();
      
      if (data.success) {
        setPendingChanges(data.changes);
      }
    } catch (error) {
      console.error('Error fetching pending changes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      toast({
        title: 'Error signing out',
        description: 'Please try again',
        status: 'error',
      });
    }
  };

  const formatPhoneNumber = (phone: string) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    return phone;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const recentTransactions = ledgerEntries.slice(0, 5);
  const currentBalance = ledgerEntries.length > 0 ? ledgerEntries[0].balance_after : 0;

  if (loading) {
    return (
      <Box minH="100vh" bg="#23201C" p={6}>
        <Container maxW="7xl">
          <VStack spacing={6} align="stretch">
            <Skeleton height="80px" borderRadius="lg" />
            <Grid templateColumns="repeat(12, 1fr)" gap={6}>
              <GridItem colSpan={4}>
                <Skeleton height="300px" borderRadius="lg" />
              </GridItem>
              <GridItem colSpan={8}>
                <Skeleton height="300px" borderRadius="lg" />
              </GridItem>
            </Grid>
          </VStack>
        </Container>
      </Box>
    );
  }

  if (!member) {
    return (
      <Box minH="100vh" bg="#23201C" display="flex" alignItems="center" justifyContent="center">
        <VStack spacing={4}>
          <Text color="#ECEDE8" fontSize="xl">Unable to load member profile</Text>
          <Button colorScheme="orange" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </VStack>
      </Box>
    );
  }

  const renderOverviewTab = () => (
    <Grid templateColumns="repeat(12, 1fr)" gap={6}>
      {/* Profile Card */}
      <GridItem colSpan={{ base: 12, lg: 4 }}>
        <Card bg="#28251F" borderColor="#3A362F" borderWidth={1}>
          <CardBody>
            <VStack spacing={4} align="center">
              <Avatar
                size="2xl"
                src={member.photo_url}
                name={`${member.first_name} ${member.last_name}`}
                bg="#BCA892"
                color="#23201C"
              />
              <VStack spacing={1} textAlign="center">
                <Heading size="md" color="#ECEDE8">
                  {member.first_name} {member.last_name}
                </Heading>
                <Text color="#BCA892" fontSize="sm">
                  Member since {formatDate(member.join_date)}
                </Text>
                <Badge
                  colorScheme={member.membership_status === 'active' ? 'green' : 'gray'}
                  variant="subtle"
                >
                  {member.membership_status}
                </Badge>
              </VStack>
              
              <Divider borderColor="#3A362F" />
              
              <VStack spacing={2} w="100%" align="start">
                <HStack>
                  <Text color="#BCA892" fontSize="sm">Email:</Text>
                  <Text color="#ECEDE8" fontSize="sm">{member.email}</Text>
                </HStack>
                <HStack>
                  <Text color="#BCA892" fontSize="sm">Phone:</Text>
                  <Text color="#ECEDE8" fontSize="sm">{formatPhoneNumber(member.phone)}</Text>
                </HStack>
                <HStack>
                  <Text color="#BCA892" fontSize="sm">Type:</Text>
                  <Text color="#ECEDE8" fontSize="sm" textTransform="capitalize">
                    {member.membership_type}
                  </Text>
                </HStack>
              </VStack>

              {pendingChanges.length > 0 && (
                <Box w="100%" p={3} bg="orange.100" borderRadius="md" border="1px solid orange.300">
                  <Text fontSize="sm" color="orange.800" fontWeight="medium">
                    {pendingChanges.length} change{pendingChanges.length > 1 ? 's' : ''} pending approval
                  </Text>
                </Box>
              )}

              <Button
                leftIcon={<EditIcon />}
                colorScheme="orange"
                variant="outline"
                size="sm"
                onClick={onProfileOpen}
                w="100%"
              >
                Edit Profile
              </Button>
            </VStack>
          </CardBody>
        </Card>
      </GridItem>

      {/* Account Balance & Quick Actions */}
      <GridItem colSpan={{ base: 12, lg: 8 }}>
        <VStack spacing={6} align="stretch">
          {/* Balance Card */}
          <Card bg="#28251F" borderColor="#3A362F" borderWidth={1}>
            <CardHeader pb={2}>
              <Heading size="md" color="#ECEDE8">Account Balance</Heading>
            </CardHeader>
            <CardBody pt={0}>
              <HStack justify="space-between" align="center">
                <VStack align="start" spacing={1}>
                  <Text fontSize="3xl" fontWeight="bold" color="#ECEDE8">
                    {formatCurrency(currentBalance)}
                  </Text>
                  <Text color="#BCA892" fontSize="sm">
                    Current balance
                  </Text>
                </VStack>
                                 <Button
                   leftIcon={<FiDollarSign />}
                   colorScheme="orange"
                   onClick={() => setActiveTab('billing')}
                 >
                   Manage Billing
                 </Button>
              </HStack>
            </CardBody>
          </Card>

          {/* Recent Transactions */}
          <Card bg="#28251F" borderColor="#3A362F" borderWidth={1}>
            <CardHeader pb={2}>
              <HStack justify="space-between">
                <Heading size="md" color="#ECEDE8">Recent Activity</Heading>
                <Button
                  size="sm"
                  variant="ghost"
                  color="#BCA892"
                  onClick={() => setActiveTab('ledger')}
                >
                  View All
                </Button>
              </HStack>
            </CardHeader>
            <CardBody pt={0}>
              {recentTransactions.length > 0 ? (
                <VStack spacing={3} align="stretch">
                  {recentTransactions.map((entry) => (
                    <HStack key={entry.id} justify="space-between" p={3} bg="#23201C" borderRadius="md">
                      <VStack align="start" spacing={1}>
                        <Text color="#ECEDE8" fontSize="sm" fontWeight="medium">
                          {entry.description}
                        </Text>
                        <Text color="#BCA892" fontSize="xs">
                          {formatDate(entry.transaction_date)}
                        </Text>
                      </VStack>
                      <Text
                        color={entry.transaction_type === 'charge' || entry.transaction_type === 'membership_fee' ? 'red.400' : 'green.400'}
                        fontWeight="bold"
                      >
                        {entry.transaction_type === 'charge' || entry.transaction_type === 'membership_fee' ? '-' : '+'}
                        {formatCurrency(entry.amount)}
                      </Text>
                    </HStack>
                  ))}
                </VStack>
              ) : (
                <Text color="#BCA892" textAlign="center" py={8}>
                  No recent activity
                </Text>
              )}
            </CardBody>
          </Card>
        </VStack>
      </GridItem>
    </Grid>
  );

  return (
    <Box minH="100vh" bg="#23201C">
      <Head>
        <title>Member Portal - Noir</title>
      </Head>

      {/* Header */}
      <Box bg="#28251F" borderBottom="1px" borderColor="#3A362F" shadow="sm">
        <Container maxW="7xl">
          <HStack justify="space-between" py={4}>
            <Heading color="#ECEDE8" size="lg">
              Noir Member Portal
            </Heading>
            
            <HStack spacing={4}>
              {/* Navigation Tabs */}
              <HStack spacing={1} display={{ base: 'none', md: 'flex' }}>
                {[
                                     { key: 'overview', label: 'Overview', icon: FiUser },
                   { key: 'profile', label: 'Profile', icon: EditIcon },
                   { key: 'ledger', label: 'Ledger', icon: FiDollarSign },
                   { key: 'billing', label: 'Billing', icon: SettingsIcon },
                   { key: 'reservations', label: 'Reservations', icon: CalendarIcon },
                ].map(({ key, label, icon: Icon }) => (
                  <Button
                    key={key}
                    variant={activeTab === key ? 'solid' : 'ghost'}
                    colorScheme={activeTab === key ? 'orange' : 'gray'}
                    size="sm"
                    leftIcon={<Icon />}
                    onClick={() => setActiveTab(key as ActiveTab)}
                    color={activeTab === key ? 'white' : '#BCA892'}
                  >
                    {label}
                  </Button>
                ))}
              </HStack>

              {/* Mobile Menu */}
              <Menu>
                <MenuButton
                  as={Button}
                  rightIcon={<ChevronDownIcon />}
                  variant="ghost"
                  color="#BCA892"
                  display={{ base: 'flex', md: 'none' }}
                >
                  Menu
                </MenuButton>
                <MenuList bg="#28251F" borderColor="#3A362F">
                  {[
                    { key: 'overview', label: 'Overview' },
                    { key: 'profile', label: 'Profile' },
                    { key: 'ledger', label: 'Ledger' },
                    { key: 'billing', label: 'Billing' },
                    { key: 'reservations', label: 'Reservations' },
                  ].map(({ key, label }) => (
                    <MenuItem
                      key={key}
                      onClick={() => setActiveTab(key as ActiveTab)}
                      bg={activeTab === key ? '#3A362F' : 'transparent'}
                      color="#ECEDE8"
                    >
                      {label}
                    </MenuItem>
                  ))}
                </MenuList>
              </Menu>

              {/* User Menu */}
              <Menu>
                <MenuButton as={IconButton} icon={<SettingsIcon />} variant="ghost" color="#BCA892" />
                <MenuList bg="#28251F" borderColor="#3A362F">
                  <MenuItem onClick={onProfileOpen} color="#ECEDE8">
                    Edit Profile
                  </MenuItem>
                  <MenuItem onClick={() => setActiveTab('billing')} color="#ECEDE8">
                    Billing Settings
                  </MenuItem>
                  <MenuItem onClick={handleSignOut} color="red.300">
                    Sign Out
                  </MenuItem>
                </MenuList>
              </Menu>
            </HStack>
          </HStack>
        </Container>
      </Box>

      {/* Main Content */}
      <Container maxW="7xl" py={8}>
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'profile' && (
          <Box>
            <Heading color="#ECEDE8" mb={6}>Profile Management</Heading>
            <Text color="#BCA892">Profile editing interface will be here</Text>
          </Box>
        )}
                 {activeTab === 'ledger' && <MemberLedger entries={ledgerEntries} />}
         {activeTab === 'billing' && <MemberBilling member={member} />}
        {activeTab === 'reservations' && (
          <Box>
            <Heading color="#ECEDE8" mb={6}>My Reservations</Heading>
            <Text color="#BCA892">Reservations management will be here</Text>
          </Box>
        )}
      </Container>

             {/* Profile Edit Modal */}
       <MemberProfileModal
         isOpen={isProfileOpen}
         onClose={onProfileClose}
         member={member}
         onUpdate={fetchMemberData}
       />
    </Box>
  );
}