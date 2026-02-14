import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Text,
  VStack,
  HStack,
  Button,
  FormControl,
  FormLabel,
  Input,
  Select,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  Badge,
  IconButton,
  Alert,
  AlertIcon,
  Divider,
  Grid,
  GridItem,
} from '@chakra-ui/react';
import { AddIcon, EditIcon, DeleteIcon } from '@chakra-ui/icons';
import { FiCreditCard, FiUser, FiMail } from 'react-icons/fi';

interface Member {
  member_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  billing_address?: any;
  stripe_customer_id?: string;
}

interface PaymentMethod {
  id: string;
  stripe_payment_method_id: string;
  card_last_four: string;
  card_brand: string;
  card_exp_month: number;
  card_exp_year: number;
  billing_name: string;
  billing_email: string;
  billing_address: any;
  is_default: boolean;
}

interface MemberBillingProps {
  member: Member;
}

const MemberBilling: React.FC<MemberBillingProps> = ({ member }) => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingPayment, setAddingPayment] = useState(false);
  const [billingForm, setBillingForm] = useState({
    billing_name: `${member.first_name} ${member.last_name}`,
    billing_email: member.email,
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'US',
  });
  
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();

  useEffect(() => {
    fetchPaymentMethods();
    loadBillingAddress();
  }, [member]);

  const fetchPaymentMethods = async () => {
    try {
      const response = await fetch('/api/member-portal/billing/payment-methods');
      const data = await response.json();
      
      if (data.success) {
        setPaymentMethods(data.payment_methods || []);
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBillingAddress = () => {
    if (member.billing_address) {
      setBillingForm(prev => ({
        ...prev,
        ...member.billing_address,
      }));
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setBillingForm(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const saveBillingAddress = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/member-portal/billing/update-address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: member.member_id,
          billing_address: billingForm,
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Billing address updated',
          status: 'success',
          duration: 3000,
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: 'Error updating billing address',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const addPaymentMethod = async () => {
    setAddingPayment(true);
    try {
      // This would integrate with Stripe's payment method creation
      // For now, we'll show a placeholder implementation
      toast({
        title: 'Payment method setup',
        description: 'This will redirect to Stripe for secure payment setup',
        status: 'info',
        duration: 5000,
      });
      
      // TODO: Implement Stripe payment method setup
      // const response = await fetch('/api/member-portal/billing/setup-payment', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     member_id: member.member_id,
      //   }),
      // });
      
    } catch (error: any) {
      toast({
        title: 'Error setting up payment method',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    } finally {
      setAddingPayment(false);
    }
  };

  const deletePaymentMethod = async (paymentMethodId: string) => {
    if (!confirm('Are you sure you want to remove this payment method?')) {
      return;
    }

    try {
      const response = await fetch('/api/member-portal/billing/delete-payment', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_method_id: paymentMethodId,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setPaymentMethods(prev => prev.filter(pm => pm.id !== paymentMethodId));
        toast({
          title: 'Payment method removed',
          status: 'success',
          duration: 3000,
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: 'Error removing payment method',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    }
  };

  const setDefaultPaymentMethod = async (paymentMethodId: string) => {
    try {
      const response = await fetch('/api/member-portal/billing/set-default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_method_id: paymentMethodId,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setPaymentMethods(prev =>
          prev.map(pm => ({
            ...pm,
            is_default: pm.id === paymentMethodId,
          }))
        );
        toast({
          title: 'Default payment method updated',
          status: 'success',
          duration: 3000,
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: 'Error updating default payment method',
        description: error.message,
        status: 'error',
        duration: 5000,
      });
    }
  };

  const getCardIcon = (brand: string) => {
    // Simple icon representation based on card brand
    switch (brand.toLowerCase()) {
      case 'visa':
        return '💳';
      case 'mastercard':
        return '💳';
      case 'amex':
        return '💳';
      default:
        return '💳';
    }
  };

  return (
    <VStack spacing={6} align="stretch">
      {/* Header */}
      <Box>
        <Heading color="#ECEDE8" size="lg" mb={2}>Billing Information</Heading>
        <Text color="#BCA892">
          Manage your payment methods and billing details
        </Text>
      </Box>

      {/* Payment Methods */}
      <Card bg="#28251F" borderColor="#3A362F" borderWidth={1}>
        <CardHeader>
          <HStack justify="space-between">
            <HStack>
              <FiCreditCard color="#BCA892" />
              <Heading size="md" color="#ECEDE8">Payment Methods</Heading>
            </HStack>
            <Button
              leftIcon={<AddIcon />}
              colorScheme="orange"
              size="sm"
              onClick={addPaymentMethod}
              isLoading={addingPayment}
              loadingText="Setting up..."
            >
              Add Payment Method
            </Button>
          </HStack>
        </CardHeader>
        <CardBody>
          {loading ? (
            <Text color="#BCA892">Loading payment methods...</Text>
          ) : paymentMethods.length === 0 ? (
            <Alert status="info" bg="#3A362F" borderColor="#BCA892">
              <AlertIcon />
              <VStack align="start" spacing={1}>
                <Text color="#ECEDE8" fontWeight="medium">No payment methods on file</Text>
                <Text color="#BCA892" fontSize="sm">
                  Add a payment method to enable automatic billing for your membership
                </Text>
              </VStack>
            </Alert>
          ) : (
            <VStack spacing={4} align="stretch">
              {paymentMethods.map((pm) => (
                <Box
                  key={pm.id}
                  p={4}
                  bg="#23201C"
                  borderRadius="md"
                  border="1px solid"
                  borderColor={pm.is_default ? "#BCA892" : "#3A362F"}
                >
                  <HStack justify="space-between">
                    <HStack spacing={3}>
                      <Text fontSize="2xl">{getCardIcon(pm.card_brand)}</Text>
                      <VStack align="start" spacing={1}>
                        <HStack>
                          <Text color="#ECEDE8" fontWeight="medium">
                            {pm.card_brand.toUpperCase()} •••• {pm.card_last_four}
                          </Text>
                          {pm.is_default && (
                            <Badge colorScheme="orange" size="sm">Default</Badge>
                          )}
                        </HStack>
                        <Text color="#BCA892" fontSize="sm">
                          Expires {pm.card_exp_month.toString().padStart(2, '0')}/{pm.card_exp_year}
                        </Text>
                        <Text color="#BCA892" fontSize="sm">
                          {pm.billing_name}
                        </Text>
                      </VStack>
                    </HStack>
                    
                    <HStack>
                      {!pm.is_default && (
                        <Button
                          size="sm"
                          variant="outline"
                          colorScheme="orange"
                          onClick={() => setDefaultPaymentMethod(pm.id)}
                        >
                          Make Default
                        </Button>
                      )}
                      <IconButton
                        aria-label="Delete payment method"
                        icon={<DeleteIcon />}
                        size="sm"
                        colorScheme="red"
                        variant="ghost"
                        onClick={() => deletePaymentMethod(pm.id)}
                      />
                    </HStack>
                  </HStack>
                </Box>
              ))}
            </VStack>
          )}
        </CardBody>
      </Card>

      {/* Billing Address */}
      <Card bg="#28251F" borderColor="#3A362F" borderWidth={1}>
        <CardHeader>
          <HStack>
            <FiUser color="#BCA892" />
            <Heading size="md" color="#ECEDE8">Billing Address</Heading>
          </HStack>
        </CardHeader>
        <CardBody>
          <Grid templateColumns="repeat(2, 1fr)" gap={4}>
            <GridItem colSpan={2}>
              <FormControl>
                <FormLabel color="#BCA892">Full Name</FormLabel>
                <Input
                  value={billingForm.billing_name}
                  onChange={(e) => handleInputChange('billing_name', e.target.value)}
                  bg="white"
                  color="black"
                />
              </FormControl>
            </GridItem>
            
            <GridItem colSpan={2}>
              <FormControl>
                <FormLabel color="#BCA892">Email Address</FormLabel>
                <Input
                  type="email"
                  value={billingForm.billing_email}
                  onChange={(e) => handleInputChange('billing_email', e.target.value)}
                  bg="white"
                  color="black"
                />
              </FormControl>
            </GridItem>
            
            <GridItem colSpan={2}>
              <FormControl>
                <FormLabel color="#BCA892">Address Line 1</FormLabel>
                <Input
                  value={billingForm.address_line1}
                  onChange={(e) => handleInputChange('address_line1', e.target.value)}
                  bg="white"
                  color="black"
                />
              </FormControl>
            </GridItem>
            
            <GridItem colSpan={2}>
              <FormControl>
                <FormLabel color="#BCA892">Address Line 2 (Optional)</FormLabel>
                <Input
                  value={billingForm.address_line2}
                  onChange={(e) => handleInputChange('address_line2', e.target.value)}
                  bg="white"
                  color="black"
                />
              </FormControl>
            </GridItem>
            
            <GridItem>
              <FormControl>
                <FormLabel color="#BCA892">City</FormLabel>
                <Input
                  value={billingForm.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  bg="white"
                  color="black"
                />
              </FormControl>
            </GridItem>
            
            <GridItem>
              <FormControl>
                <FormLabel color="#BCA892">State</FormLabel>
                <Select
                  value={billingForm.state}
                  onChange={(e) => handleInputChange('state', e.target.value)}
                  bg="white"
                  color="black"
                >
                  <option value="">Select State</option>
                  <option value="CA">California</option>
                  <option value="NY">New York</option>
                  <option value="TX">Texas</option>
                  {/* Add more states as needed */}
                </Select>
              </FormControl>
            </GridItem>
            
            <GridItem>
              <FormControl>
                <FormLabel color="#BCA892">ZIP Code</FormLabel>
                <Input
                  value={billingForm.postal_code}
                  onChange={(e) => handleInputChange('postal_code', e.target.value)}
                  bg="white"
                  color="black"
                />
              </FormControl>
            </GridItem>
            
            <GridItem>
              <FormControl>
                <FormLabel color="#BCA892">Country</FormLabel>
                <Select
                  value={billingForm.country}
                  onChange={(e) => handleInputChange('country', e.target.value)}
                  bg="white"
                  color="black"
                >
                  <option value="US">United States</option>
                  <option value="CA">Canada</option>
                </Select>
              </FormControl>
            </GridItem>
          </Grid>
          
          <Box mt={6}>
            <Button
              colorScheme="orange"
              onClick={saveBillingAddress}
              isLoading={loading}
              loadingText="Saving..."
            >
              Save Billing Address
            </Button>
          </Box>
        </CardBody>
      </Card>

      {/* Membership Info */}
      <Card bg="#28251F" borderColor="#3A362F" borderWidth={1}>
        <CardHeader>
          <HStack>
            <FiMail color="#BCA892" />
            <Heading size="md" color="#ECEDE8">Membership & Billing</Heading>
          </HStack>
        </CardHeader>
        <CardBody>
          <VStack spacing={4} align="stretch">
            <HStack justify="space-between">
              <Text color="#BCA892">Membership Type:</Text>
              <Text color="#ECEDE8" fontWeight="medium">Standard Membership</Text>
            </HStack>
            <HStack justify="space-between">
              <Text color="#BCA892">Monthly Fee:</Text>
              <Text color="#ECEDE8" fontWeight="medium">$100.00</Text>
            </HStack>
            <HStack justify="space-between">
              <Text color="#BCA892">Next Billing Date:</Text>
              <Text color="#ECEDE8" fontWeight="medium">
                {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
              </Text>
            </HStack>
            
            <Divider borderColor="#3A362F" />
            
            <Alert status="info" bg="#3A362F" borderColor="#BCA892">
              <AlertIcon />
              <VStack align="start" spacing={1}>
                <Text color="#ECEDE8" fontSize="sm" fontWeight="medium">
                  Billing changes require admin approval
                </Text>
                <Text color="#BCA892" fontSize="xs">
                  Contact our concierge team for membership changes or cancellation requests
                </Text>
              </VStack>
            </Alert>
          </VStack>
        </CardBody>
      </Card>
    </VStack>
  );
};

export default MemberBilling;