'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Button,
  Container,
  Card,
  CardBody,
  useToast,
  Icon,
  Radio,
  RadioGroup,
  Divider,
  Badge,
  List,
  ListItem,
  ListIcon
} from '@chakra-ui/react';
import { useRouter, useParams } from 'next/navigation';
import { CreditCard, Check, DollarSign } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface WaitlistData {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  selected_membership?: string;
}

interface MembershipPlan {
  type: string;
  base_fee: number;
  description: string;
}

export default function PaymentPage() {
  const [waitlistData, setWaitlistData] = useState<WaitlistData | null>(null);
  const [membershipPlans, setMembershipPlans] = useState<MembershipPlan[]>([]);
  const [selectedMembership, setSelectedMembership] = useState<string>('');
  const [clientSecret, setClientSecret] = useState('');
  const [loading, setLoading] = useState(true);

  const router = useRouter();
  const params = useParams();
  const toast = useToast();
  const token = params?.token as string;

  useEffect(() => {
    loadPaymentInfo();
  }, [token]);

  const loadPaymentInfo = async () => {
    try {
      const response = await fetch(`/api/payment/validate?token=${token}`);
      if (!response.ok) {
        throw new Error('Invalid or expired token');
      }

      const data = await response.json();
      setWaitlistData(data.waitlist);
      setMembershipPlans(data.membership_plans || []);

      // Pre-select membership if already chosen
      if (data.waitlist.selected_membership) {
        setSelectedMembership(data.waitlist.selected_membership);
      } else if (data.membership_plans.length > 0) {
        setSelectedMembership(data.membership_plans[0].type);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Invalid or expired payment link',
        status: 'error',
        duration: 5000,
      });
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const handleMembershipChange = (value: string) => {
    setSelectedMembership(value);
    setClientSecret(''); // Reset payment intent when changing membership
  };

  const handleContinueToPayment = async () => {
    if (!selectedMembership) {
      toast({
        title: 'Select Membership',
        description: 'Please select a membership type',
        status: 'warning',
        duration: 3000,
      });
      return;
    }

    try {
      // Create payment intent
      const response = await fetch('/api/payment/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          membership_type: selectedMembership
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create payment intent');
      }

      const data = await response.json();
      setClientSecret(data.client_secret);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to initialize payment',
        status: 'error',
        duration: 5000,
      });
    }
  };

  if (loading) {
    return (
      <Box minH="100vh" bg="#1F1F1F" display="flex" alignItems="center" justifyContent="center">
        <Text color="white">Loading payment information...</Text>
      </Box>
    );
  }

  if (!waitlistData) {
    return null;
  }

  const selectedPlan = membershipPlans.find(p => p.type === selectedMembership);

  return (
    <Box minH="100vh" bg="#1F1F1F" py={8}>
      <Container maxW="container.md">
        {/* Header */}
        <VStack spacing={6} mb={8}>
          <Box
            bg="#A59480"
            borderRadius="full"
            p={4}
            boxShadow="0 4px 8px rgba(0,0,0,0.2), 0 8px 16px rgba(0,0,0,0.2)"
          >
            <Icon as={DollarSign} w={8} h={8} color="white" />
          </Box>
          <VStack spacing={2} textAlign="center">
            <Heading fontSize={{ base: '2xl', md: '4xl' }} color="white">
              Complete Your Membership
            </Heading>
            <Text color="#ECEDE8">
              Select your membership tier and complete payment
            </Text>
          </VStack>
        </VStack>

        {/* Membership Selection Card */}
        {!clientSecret && (
          <Card
            bg="#ECEDE8"
            boxShadow="0 2px 4px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.1)"
            mb={6}
          >
            <CardBody p={{ base: 6, md: 8 }}>
              <VStack spacing={6} align="stretch">
                <Heading size="md" color="#353535">
                  Select Membership Tier
                </Heading>

                <RadioGroup value={selectedMembership} onChange={handleMembershipChange}>
                  <VStack spacing={4} align="stretch">
                    {membershipPlans.map(plan => (
                      <Box
                        key={plan.type}
                        p={4}
                        borderRadius="md"
                        borderWidth="2px"
                        borderColor={selectedMembership === plan.type ? '#A59480' : 'gray.300'}
                        bg={selectedMembership === plan.type ? '#A5948010' : 'white'}
                        cursor="pointer"
                        transition="all 0.2s"
                        _hover={{ borderColor: '#A59480' }}
                        onClick={() => handleMembershipChange(plan.type)}
                      >
                        <HStack justify="space-between" align="start">
                          <Radio value={plan.type} colorScheme="orange" size="lg">
                            <VStack align="start" spacing={1}>
                              <Text fontSize="lg" fontWeight="bold" color="#353535">
                                {plan.type}
                              </Text>
                              <Text fontSize="sm" color="gray.600">
                                {plan.description}
                              </Text>
                            </VStack>
                          </Radio>
                          <Badge colorScheme="orange" fontSize="lg" px={3} py={1}>
                            ${(plan.base_fee / 100).toFixed(0)}
                          </Badge>
                        </HStack>
                      </Box>
                    ))}
                  </VStack>
                </RadioGroup>

                {selectedPlan && (
                  <>
                    <Divider />

                    {/* Payment Methods Info */}
                    <VStack spacing={3} align="stretch">
                      <Heading size="sm" color="#353535">
                        Payment Options
                      </Heading>
                      <List spacing={2}>
                        <ListItem display="flex" alignItems="center">
                          <ListIcon as={CreditCard} color="#A59480" />
                          <Text fontSize="sm" color="gray.600">
                            Credit Card (+4% processing fee)
                          </Text>
                        </ListItem>
                        <ListItem display="flex" alignItems="center">
                          <ListIcon as={Check} color="green.500" />
                          <Text fontSize="sm" color="gray.600">
                            ACH/Bank Transfer (No fees)
                          </Text>
                        </ListItem>
                      </List>
                    </VStack>

                    <Button
                      size="lg"
                      bg="#A59480"
                      color="white"
                      _hover={{ bg: '#8F7F6B' }}
                      onClick={handleContinueToPayment}
                      rightIcon={<Icon as={CreditCard} />}
                      boxShadow="0 2px 4px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.1)"
                      minH="56px"
                    >
                      Continue to Payment
                    </Button>
                  </>
                )}
              </VStack>
            </CardBody>
          </Card>
        )}

        {/* Payment Form */}
        {clientSecret && (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: 'stripe',
                variables: {
                  spacingUnit: '4px',
                  borderRadius: '6px',
                },
              }
            }}
          >
            <PaymentForm
              token={token}
              waitlistData={waitlistData}
              selectedMembership={selectedMembership}
              amount={selectedPlan?.base_fee || 0}
            />
          </Elements>
        )}
      </Container>
    </Box>
  );
}

// Payment Form Component (must be inside Elements provider)
function PaymentForm({
  token,
  waitlistData,
  selectedMembership,
  amount
}: {
  token: string;
  waitlistData: WaitlistData;
  selectedMembership: string;
  amount: number;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment/success?token=${token}`,
        },
      });

      if (error) {
        toast({
          title: 'Payment Failed',
          description: error.message,
          status: 'error',
          duration: 5000,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to process payment',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card
      bg="#ECEDE8"
      boxShadow="0 2px 4px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.1)"
    >
      <CardBody p={{ base: 6, md: 8 }}>
        <form onSubmit={handleSubmit}>
          <VStack spacing={6} align="stretch">
            {/* Summary */}
            <VStack spacing={2} align="stretch">
              <HStack justify="space-between">
                <Text fontSize="sm" color="gray.600">Member:</Text>
                <Text fontSize="sm" fontWeight="bold" color="#353535">
                  {waitlistData.first_name} {waitlistData.last_name}
                </Text>
              </HStack>
              <HStack justify="space-between">
                <Text fontSize="sm" color="gray.600">Membership:</Text>
                <Badge colorScheme="orange">{selectedMembership}</Badge>
              </HStack>
              <Divider />
              <HStack justify="space-between">
                <Text fontSize="lg" fontWeight="bold" color="#353535">Total:</Text>
                <Text fontSize="2xl" fontWeight="bold" color="#A59480">
                  ${(amount / 100).toFixed(0)}
                </Text>
              </HStack>
            </VStack>

            <Divider />

            {/* Stripe Payment Element */}
            <Box>
              <PaymentElement />
            </Box>

            {/* Submit Button */}
            <Button
              type="submit"
              size="lg"
              bg="#A59480"
              color="white"
              _hover={{ bg: '#8F7F6B' }}
              isLoading={submitting}
              isDisabled={!stripe || !elements}
              leftIcon={<Icon as={Check} />}
              boxShadow="0 2px 4px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.1)"
              minH="56px"
            >
              Complete Payment
            </Button>

            <Text fontSize="xs" color="gray.500" textAlign="center">
              Your payment is processed securely by Stripe
            </Text>
          </VStack>
        </form>
      </CardBody>
    </Card>
  );
}
