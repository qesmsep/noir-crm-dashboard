import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  FormControl,
  FormLabel,
  Input,
  Select,
  useToast,
  Spinner,
  Text,
  Badge,
  IconButton,
  Tooltip,
  Alert,
  AlertIcon,
  VStack,
  HStack,
  Heading,
  useDisclosure,
  Grid,
  GridItem,
} from '@chakra-ui/react';
import { EditIcon, DeleteIcon, AddIcon } from '@chakra-ui/icons';
import AdminLayout from '../../components/layouts/AdminLayout';
import { supabase } from '../../lib/supabase';

interface Admin {
  id: string;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  access_level: string;
  status: 'active' | 'inactive';
  created_at: string;
  last_login_at?: string;
}

interface AdminFormData {
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  access_level: string;
  password?: string;
}

interface AdminFilters {
  search: string;
  status: string;
  access_level: string;
}

export default function AdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [formData, setFormData] = useState<AdminFormData>({
    email: '',
    phone: '',
    first_name: '',
    last_name: '',
    access_level: 'admin',
  });
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AdminFilters>({
    search: '',
    status: '',
    access_level: '',
  });
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();

  // Check super admin access and fetch admins on component mount
  useEffect(() => {
    checkSuperAdminAccess();
  }, []);

  const checkSuperAdminAccess = async () => {
    try {
      setCheckingAccess(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        setIsSuperAdmin(false);
        setError('Authentication required');
        return;
      }

      // Check if current user is a super admin
      const { data: adminData, error } = await supabase
        .from('admins')
        .select('access_level, status')
        .eq('auth_user_id', session.user.id)
        .eq('status', 'active')
        .single();

      if (error || !adminData) {
        setIsSuperAdmin(false);
        setError('Admin access required');
        return;
      }

      if (adminData.access_level !== 'super_admin') {
        setIsSuperAdmin(false);
        setError('Super admin access required to manage admins');
        return;
      }

      setIsSuperAdmin(true);
      setError(null);
      fetchAdmins();
    } catch (err: any) {
      console.error('Error checking super admin access:', err);
      setIsSuperAdmin(false);
      setError('Failed to verify access');
    } finally {
      setCheckingAccess(false);
    }
  };

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admins');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch admins');
      }

      setAdmins(result.data || []);
    } catch (err: any) {
      console.error('Error fetching admins:', err);
      setError(err.message);
      toast({
        title: 'Error',
        description: 'Failed to load admins',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      phone: '',
      first_name: '',
      last_name: '',
      access_level: 'admin',
    });
    setEditingAdmin(null);
  };

  const handleAddAdmin = () => {
    resetForm();
    onOpen();
  };

  const handleEditAdmin = (admin: Admin) => {
    setEditingAdmin(admin);
    setFormData({
      email: admin.email,
      phone: admin.phone,
      first_name: admin.first_name,
      last_name: admin.last_name,
      access_level: admin.access_level,
    });
    onOpen();
  };

  const handleDeleteAdmin = async (admin: Admin) => {
    if (!window.confirm(`Are you sure you want to remove ${admin.first_name} ${admin.last_name} as an admin?`)) {
      return;
    }

    try {
      setSaving(true);

      // Get current user's session for authorization
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/admins?id=${admin.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Super admin access required to remove admins');
        }
        throw new Error(result.error || 'Failed to remove admin');
      }

      toast({
        title: 'Success',
        description: 'Admin removed successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      fetchAdmins();
    } catch (err: any) {
      console.error('Error removing admin:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to remove admin',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      setError(null);

      if (!formData.email || !formData.first_name || !formData.last_name) {
        setError('Please fill in all required fields');
        return;
      }

      // Get current user's session for authorization
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const method = editingAdmin ? 'PUT' : 'POST';
      const body = editingAdmin 
        ? { id: editingAdmin.id, ...formData }
        : formData;

      const response = await fetch('/api/admins', {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Super admin access required to manage admins');
        }
        throw new Error(result.error || 'Failed to save admin');
      }

      toast({
        title: 'Success',
        description: editingAdmin ? 'Admin updated successfully' : 'Admin created successfully',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      onClose();
      resetForm();
      fetchAdmins();
    } catch (err: any) {
      console.error('Error saving admin:', err);
      setError(err.message);
      toast({
        title: 'Error',
        description: err.message || 'Failed to save admin',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Filter admins based on search and filters
  const filteredAdmins = admins.filter(admin => {
    const matchesSearch = !filters.search || 
      admin.first_name.toLowerCase().includes(filters.search.toLowerCase()) ||
      admin.last_name.toLowerCase().includes(filters.search.toLowerCase()) ||
      admin.email.toLowerCase().includes(filters.search.toLowerCase()) ||
      admin.phone.includes(filters.search);
    
    const matchesStatus = !filters.status || admin.status === filters.status;
    const matchesAccessLevel = !filters.access_level || admin.access_level === filters.access_level;
    
    return matchesSearch && matchesStatus && matchesAccessLevel;
  });

  if (checkingAccess) {
    return (
      <AdminLayout>
        <Box p={8} display="flex" justifyContent="center" alignItems="center" minH="100vh">
          <VStack spacing={4}>
            <Spinner size="xl" />
            <Text fontFamily="'Montserrat', sans-serif">Checking access...</Text>
          </VStack>
        </Box>
      </AdminLayout>
    );
  }

  if (!isSuperAdmin) {
    return (
      <AdminLayout>
        <Box p={8} display="flex" justifyContent="center" alignItems="center" minH="100vh">
          <VStack spacing={4}>
            <Text fontSize="xl" fontFamily="'Montserrat', sans-serif" color="red.500">
              Access Denied
            </Text>
            <Text fontFamily="'Montserrat', sans-serif" textAlign="center">
              {error || 'Super admin access required to manage admins'}
            </Text>
            <Text fontSize="sm" fontFamily="'Montserrat', sans-serif" color="gray.500">
              Only super admins can access this page. Contact your system administrator.
            </Text>
          </VStack>
        </Box>
      </AdminLayout>
    );
  }

  if (loading) {
    return (
      <AdminLayout>
        <Box p={8} display="flex" justifyContent="center" alignItems="center" minH="100vh">
          <Spinner size="xl" />
        </Box>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Box p={4} minH="100vh" bg="#353535" color="#ECEDE8">
        <Box position="relative" ml={10} mr={10} zIndex={1} pt={28}>
          <HStack justify="space-between" mb={8}>
            <VStack align="start" spacing={1}>
              <Heading size="lg" fontFamily="'Montserrat', sans-serif" color="#a59480">
                Admin Management
              </Heading>
              <Text fontSize="sm" color="gray.400" fontFamily="'Montserrat', sans-serif">
                Manage admin users and their access levels
              </Text>
            </VStack>
            <Button
              leftIcon={<AddIcon />}
              colorScheme="blue"
              onClick={handleAddAdmin}
              fontFamily="'Montserrat', sans-serif"
            >
              Add Admin
            </Button>
          </HStack>

          {/* Admin Statistics */}
          <Box bg="#a59480" p={4} borderRadius="lg" mb={6} border="1px solid #ecede8">
            <HStack justify="space-around" textAlign="center">
              <VStack>
                <Text fontSize="2xl" fontWeight="bold" color="white" fontFamily="'Montserrat', sans-serif">
                  {admins.length}
                </Text>
                <Text fontSize="sm" color="white" fontFamily="'Montserrat', sans-serif">
                  Total Admins
                </Text>
              </VStack>
              <VStack>
                <Text fontSize="2xl" fontWeight="bold" color="white" fontFamily="'Montserrat', sans-serif">
                  {admins.filter(a => a.status === 'active').length}
                </Text>
                <Text fontSize="sm" color="white" fontFamily="'Montserrat', sans-serif">
                  Active Admins
                </Text>
              </VStack>
              <VStack>
                <Text fontSize="2xl" fontWeight="bold" color="white" fontFamily="'Montserrat', sans-serif">
                  {admins.filter(a => a.access_level === 'super_admin').length}
                </Text>
                <Text fontSize="sm" color="white" fontFamily="'Montserrat', sans-serif">
                  Super Admins
                </Text>
              </VStack>
            </HStack>
          </Box>

          {/* Search and Filters */}
          <Box bg="white" p={4} borderRadius="lg" mb={6} boxShadow="sm">
            <HStack spacing={4} wrap="wrap">
              <FormControl maxW="300px">
                <FormLabel fontSize="sm" color="#353535"fontFamily="'Montserrat', sans-serif">Search</FormLabel>
                <Input
                  placeholder="Search by name, email, or phone..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  fontFamily="'Montserrat', sans-serif"
                />
              </FormControl>
              <FormControl maxW="200px">
                <FormLabel fontSize="sm" color="#353535"fontFamily="'Montserrat', sans-serif">Status</FormLabel>
                <Select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  fontFamily="'Montserrat', sans-serif"
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </FormControl>
              <FormControl maxW="200px">
                <FormLabel fontSize="sm" color="#353535"fontFamily="'Montserrat', sans-serif">Access Level</FormLabel>
                <Select
                  value={filters.access_level}
                  onChange={(e) => setFilters({ ...filters, access_level: e.target.value })}
                  fontFamily="'Montserrat', sans-serif"
                >
                  <option value="">All Levels</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </Select>
              </FormControl>
              <Button
                variant="outline"
                onClick={() => setFilters({ search: '', status: '', access_level: '' })}
                fontFamily="'Montserrat', sans-serif"
                mt={8}
              >
                Clear Filters
              </Button>
            </HStack>
          </Box>

          {error && (
            <Alert status="error" mb={4}>
              <AlertIcon />
              {error}
            </Alert>
          )}

          <Box bg="white" borderRadius="lg" overflow="hidden" boxShadow="lg" width="90%" mx="auto">
            <Table variant="simple" width="100%">
              <Thead bg="#a59480">
                <Tr>
                  <Th color="white" fontFamily="'Montserrat', sans-serif" width="15%">Name</Th>
                  <Th color="white" fontFamily="'Montserrat', sans-serif" width="20%">Email</Th>
                  <Th color="white" fontFamily="'Montserrat', sans-serif" width="12%">Phone</Th>
                  <Th color="white" fontFamily="'Montserrat', sans-serif" width="12%">Access Level</Th>
                  <Th color="white" fontFamily="'Montserrat', sans-serif" width="10%">Status</Th>
                  <Th color="white" fontFamily="'Montserrat', sans-serif" width="15%">Last Login</Th>
                  <Th color="white" fontFamily="'Montserrat', sans-serif" width="16%">Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredAdmins.map((admin) => (
                  <Tr key={admin.id}>
                    <Td fontFamily="'Montserrat', sans-serif" color="#353535">
                      {admin.first_name} {admin.last_name}
                    </Td>
                    <Td fontFamily="'Montserrat', sans-serif" color="#353535">{admin.email}</Td>
                    <Td fontFamily="'Montserrat', sans-serif" color="#353535">{admin.phone}</Td>
                    <Td>
                      <Badge 
                        
                        color="#353535" 
                        fontFamily="'Montserrat', sans-serif"
                      >
                        {admin.access_level}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge
                        bg={admin.status === 'active' ? '' : '#e53e3e'}
                        color="#353535"
                        fontFamily="'Montserrat', sans-serif"
                      >
                        {admin.status}
                      </Badge>
                    </Td>
                    <Td fontFamily="'Montserrat', sans-serif" color="#353535">
                      {admin.last_login_at ? formatDate(admin.last_login_at) : 'Never'}
                    </Td>
                    <Td>
                      <HStack spacing={2}>
                        <Tooltip label="Edit Admin">
                          <IconButton
                            aria-label="Edit admin"
                            icon={<EditIcon />}
                            size="sm"
                            colorScheme="blue"
                            onClick={() => handleEditAdmin(admin)}
                          />
                        </Tooltip>
                        <Tooltip label="Remove Admin">
                          <IconButton
                            aria-label="Remove admin"
                            icon={<DeleteIcon />}
                            size="sm"
                            colorScheme="red"
                            onClick={() => handleDeleteAdmin(admin)}
                            isDisabled={saving}
                          />
                        </Tooltip>
                      </HStack>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>

          {filteredAdmins.length === 0 && !loading && (
            <Box textAlign="center" py={8}>
              <Text fontFamily="'Montserrat', sans-serif" color="gray.500">
                {admins.length === 0 
                  ? 'No admins found. Click "Add Admin" to create the first admin.'
                  : 'No admins match your current filters. Try adjusting your search criteria.'
                }
              </Text>
            </Box>
          )}
        </Box>
      </Box>

      {/* Add/Edit Admin Drawer */}
      <Drawer 
        isOpen={isOpen} 
        placement="right" 
        onClose={onClose} 
        size="sm"
        closeOnOverlayClick={true}
        closeOnEsc={true}
      >
        <Box zIndex="2000" position="relative">
          <DrawerOverlay bg="blackAlpha.600" onClick={onClose} />
                  <DrawerContent 
          border="2px solid #353535" 
          borderRadius="10px"  
          fontFamily="Montserrat, sans-serif" 
          maxW="350px" 
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
            transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
            <DrawerHeader borderBottomWidth="1px" margin="0" fontWeight="bold" paddingTop="0px" fontSize="0px" fontFamily="IvyJournal, sans-serif" color="#353535">
              
            </DrawerHeader>
            <DrawerBody p={4} overflowY="auto" className="drawer-body-content">
              <VStack spacing={4} align="stretch">
                <Box>
                  <Text mb="0px" fontSize="24px" fontWeight="bold" fontFamily="IvyJournal, sans-serif">
                    {editingAdmin ? 'Edit Admin' : 'Add New Admin'}
                  </Text>
                </Box>

                <VStack spacing={4} as="section" align="stretch">
                  <Grid templateColumns="repeat(2, 1fr)" gap={2}>
                    <GridItem>
                      <FormControl isRequired>
                        <FormLabel fontSize="sm" mb={1} fontFamily="'Montserrat', sans-serif">First Name</FormLabel>
                        <Input
                          value={formData.first_name}
                          onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                          fontFamily="'Montserrat', sans-serif"
                          size="sm"
                        />
                      </FormControl>
                    </GridItem>
                    <GridItem>
                      <FormControl isRequired>
                        <FormLabel fontSize="sm" mb={1} fontFamily="'Montserrat', sans-serif">Last Name</FormLabel>
                        <Input
                          value={formData.last_name}
                          onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                          fontFamily="'Montserrat', sans-serif"
                          size="sm"
                        />
                      </FormControl>
                    </GridItem>
                    <GridItem colSpan={2}>
                      <FormControl isRequired>
                        <FormLabel fontSize="sm" mb={1} fontFamily="'Montserrat', sans-serif">Email</FormLabel>
                        <Input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          fontFamily="'Montserrat', sans-serif"
                          size="sm"
                        />
                      </FormControl>
                    </GridItem>
                    <GridItem colSpan={2}>
                      <FormControl>
                        <FormLabel fontSize="sm" mb={1} fontFamily="'Montserrat', sans-serif">Phone</FormLabel>
                        <Input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="+1 (555) 123-4567"
                          fontFamily="'Montserrat', sans-serif"
                          size="sm"
                        />
                      </FormControl>
                    </GridItem>
                    <GridItem colSpan={2}>
                      <FormControl>
                        <FormLabel fontSize="sm" mb={1} fontFamily="'Montserrat', sans-serif">Access Level</FormLabel>
                        <Select
                          value={formData.access_level}
                          onChange={(e) => setFormData({ ...formData, access_level: e.target.value })}
                          fontFamily="'Montserrat', sans-serif"
                          size="sm"
                        >
                          <option value="admin">Admin</option>
                          <option value="super_admin">Super Admin</option>
                        </Select>
                        <Text fontSize="sm" color="gray.500" mt={1}>
                          {formData.access_level === 'admin' 
                            ? 'Can manage members, reservations, settings, and templates'
                            : 'Can manage everything including other admins and system settings'
                          }
                        </Text>
                      </FormControl>
                    </GridItem>
                    {!editingAdmin && (
                      <GridItem colSpan={2}>
                        <FormControl isRequired>
                          <FormLabel fontSize="sm" mb={1} fontFamily="'Montserrat', sans-serif">Password</FormLabel>
                          <Input
                            type="password"
                            value={formData.password || ''}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            fontFamily="'Montserrat', sans-serif"
                            size="sm"
                          />
                        </FormControl>
                      </GridItem>
                    )}
                  </Grid>
                </VStack>
              </VStack>
            </DrawerBody>
              <DrawerFooter borderTopWidth="1px" justifyContent="space-between" className="drawer-footer-content">
                <HStack spacing={3} mb={"10px"}>
                  <Button variant="outline" onClick={onClose} fontFamily="'Montserrat', sans-serif">
                    Cancel
                  </Button>
                  <Button 
                    bg="#353535"
                    color="#ecede8"
                    _hover={{ bg: '#2a2a2a' }}
                    fontFamily="'Montserrat', sans-serif"
                    fontWeight="semibold"
                    onClick={handleSubmit} 
                    isLoading={saving}
                  >
                    {editingAdmin ? 'Update' : 'Create'}
                  </Button>
                </HStack>
              </DrawerFooter>
            </DrawerContent>
          </Box>
        </Drawer>
      </AdminLayout>
    );
  } 