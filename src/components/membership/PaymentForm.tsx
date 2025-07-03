import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import {
  VStack,
  Text,
  Button,
  Heading,
  Alert,
  AlertIcon,
  Box,
  HStack,
  Icon,
  Divider,
  FormControl,
  FormLabel
} from '@chakra-ui/react';
import { FiCreditCard, FiLock, FiShield } from 'react-icons/fi';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface Application {
  id?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
}

interface Props {
  application: Application | null;
  onComplete: (data: any) => void;
  onError: (message: string) => void;
}

function PaymentFormInner({ application, onComplete, onError }: Props) {
  const stripe = useStripe();
  const elements = useElements();
  
  const [clientSecret, setClientSecret] = useState('');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [currency, setCurrency] = useState('usd');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    createPaymentIntent();
  }, []);

  const createPaymentIntent = async () => {
    if (!application?.id) {
      onError('Application not found');
      return;
    }

    try {
      const response = await fetch('/api/membership/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: application.id,
          email: application.email,
          first_name: application.first_name,
          last_name: application.last_name
        })
      });

      if (response.ok) {
        const data = await response.json();
        setClientSecret(data.client_secret);
        setPaymentAmount(data.amount);
        setCurrency(data.currency);
      } else {
        const errorData = await response.json();
        onError(errorData.error || 'Failed to initialize payment');
      }
    } catch (error) {
      onError('Error initializing payment');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements || !clientSecret) {
      return;
    }

    setProcessing(true);

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      onError('Card element not found');
      setProcessing(false);
      return;
    }

    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: cardElement,
        billing_details: {
          name: `${application?.first_name} ${application?.last_name}`,
          email: application?.email
        }
      }
    });

    if (error) {
      onError(error.message || 'Payment failed');
      setProcessing(false);
    } else if (paymentIntent.status === 'succeeded') {
      // Confirm payment on backend
      try {
        const response = await fetch('/api/membership/payment', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payment_intent_id: paymentIntent.id
          })
        });

        if (response.ok) {
          const data = await response.json();
          onComplete(data.application);
        } else {
          const errorData = await response.json();
          onError(errorData.error || 'Failed to confirm payment');
        }
      } catch (error) {
        onError('Error confirming payment');
      }
      setProcessing(false);
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount / 100);
  };

  if (loading) {
    return <Text>Loading payment information...</Text>;
  }

  return (
    <VStack spacing={6} align="stretch">
      <VStack spacing={2} align="start">
        <Heading size="md">Membership Payment</Heading>
        <Text color="gray.600">
          Complete your membership application with a one-time payment
        </Text>
      </VStack>

      {/* Payment Amount */}
      <Box bg="blue.50" p={4} borderRadius="md">
        <HStack justify="space-between" align="center">
          <VStack align="start" spacing={0}>
            <Text fontWeight="bold">Membership Fee</Text>
            <Text fontSize="sm" color="gray.600">One-time application fee</Text>
          </VStack>
          <Text fontSize="2xl" fontWeight="bold" color="blue.600">
            {formatAmount(paymentAmount, currency)}
          </Text>
        </HStack>
      </Box>

      <Divider />

      {/* Payment Form */}
      <form onSubmit={handleSubmit}>
        <VStack spacing={6}>
          <FormControl>
            <FormLabel>
              <HStack>
                <Icon as={FiCreditCard} />
                <Text>Payment Information</Text>
              </HStack>
            </FormLabel>
            <Box
              p={4}
              border="1px"
              borderColor="gray.200"
              borderRadius="md"
              bg="white"
            >
              <CardElement
                options={{
                  style: {
                    base: {
                      fontSize: '16px',
                      color: '#424770',
                      '::placeholder': {
                        color: '#aab7c4',
                      },
                    },
                    invalid: {
                      color: '#9e2146',
                    },
                  },
                }}
              />
            </Box>
          </FormControl>

          {/* Security Notice */}
          <Box bg="green.50" p={4} borderRadius="md">
            <HStack spacing={2}>
              <Icon as={FiShield} color="green.500" />
              <VStack align="start" spacing={1}>
                <Text fontSize="sm" fontWeight="bold" color="green.700">
                  Secure Payment
                </Text>
                <Text fontSize="xs" color="green.600">
                  Your payment information is encrypted and processed securely by Stripe.
                  We never store your credit card details.
                </Text>
              </VStack>
            </HStack>
          </Box>

          <Button
            type="submit"
            colorScheme="blue"
            size="lg"
            w="full"
            isLoading={processing}
            loadingText="Processing Payment..."
            isDisabled={!stripe || processing}
            leftIcon={<Icon as={FiLock} />}
          >
            Pay {formatAmount(paymentAmount, currency)} & Complete Application
          </Button>
        </VStack>
      </form>

      {/* Payment Terms */}
      <Box bg="gray.50" p={4} borderRadius="md">
        <Text fontSize="xs" color="gray.600">
          By completing this payment, you acknowledge that:
          <br />• This is a one-time membership application fee
          <br />• Payment is processed securely through Stripe
          <br />• Your membership application will be reviewed upon successful payment
          <br />• Membership fees are non-refundable once application is approved
        </Text>
      </Box>
    </VStack>
  );
}

export default function PaymentForm(props: Props) {
  return (
    <Elements stripe={stripePromise}>
      <PaymentFormInner {...props} />
    </Elements>
  );
}