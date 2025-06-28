import React, { useState } from 'react';
import { PaymentElement, useStripe, useElements, Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import {
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  DrawerCloseButton,
  Button,
  FormControl,
  FormLabel,
  Input,
  Text,
  VStack,
  useToast,
  Box,
} from '@chakra-ui/react';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

interface CreditCardHoldModalProps {
  partySize: number;
  onSuccess: (holdId: string, customerInfo: CustomerInfo) => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

interface CustomerInfo {
  firstName: string;
  lastName: string;
  email: string;
}

interface FormData extends CustomerInfo {}

function getHoldAmount(partySize: number): number {
  return 25;
}

const CreditCardHoldDrawer: React.FC<CreditCardHoldModalProps> = ({
  partySize,
  onSuccess,
  onCancel,
  isProcessing = false
}) => {
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: ''
  });
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const holdAmount = getHoldAmount(partySize);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/create-hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: holdAmount }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create hold');
      }

      const { clientSecret: secret } = await response.json();
      if (!secret) {
        throw new Error('No client secret received');
      }
      setClientSecret(secret);
      setStep(2);
    } catch (err: any) {
      const errorMessage = err.message || 'An error occurred while creating the hold';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        status: 'error',
        duration: 3000,
      });
    } finally {
      setProcessing(false);
    }
  };

  // Step 2: Show PaymentElement and confirm payment
  function PaymentStep() {
    const stripe = useStripe();
    const elements = useElements();
    const [payError, setPayError] = useState<string | null>(null);
    const [payProcessing, setPayProcessing] = useState(false);

    const handlePaymentSubmit = async (event: React.FormEvent) => {
      event.preventDefault();
      if (!stripe || !elements) {
        setPayError('Stripe is not loaded. Please try again in a moment.');
        return;
      }
      setPayProcessing(true);
      setPayError(null);
      try {
        const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
          elements,
          confirmParams: {
            payment_method_data: {
              billing_details: {
                name: `${formData.firstName} ${formData.lastName}`.trim(),
                email: formData.email
              }
            },
          },
          redirect: 'if_required',
        });
        if (stripeError) {
          setPayError(stripeError.message || 'Payment failed');
          setPayProcessing(false);
          return;
        }
        if (paymentIntent) {
          onSuccess(paymentIntent.id, formData);
        }
      } catch (err) {
        const error = err as Error;
        setPayError(error.message);
        toast({
          title: 'Payment error',
          description: error.message,
          status: 'error',
          duration: 3000,
        });
      } finally {
        setPayProcessing(false);
      }
    };

    return (
      <form onSubmit={handlePaymentSubmit}>
        <VStack spacing={4} align="stretch">
          <Box>
            <Text fontSize="xl" color="blue.700" fontWeight="bold" mb={4}>
              Hold Amount: ${holdAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' }).replace('$','')}
            </Text>
            <PaymentElement options={{ layout: 'tabs' }} />
          </Box>
          {payError && (
            <Text color="red.500">{payError}</Text>
          )}
          <Box display="flex" justifyContent="flex-end" gap={4}>
            <Button onClick={onCancel} isDisabled={payProcessing} variant="ghost">
              Cancel
            </Button>
            <Button
              type="submit"
              colorScheme="blue"
              isLoading={payProcessing}
              loadingText="Processing..."
            >
              Complete Reservation
            </Button>
          </Box>
        </VStack>
      </form>
    );
  }

  return (
    <Drawer isOpen={true} placement="right" onClose={onCancel} size="md">
      <DrawerOverlay />
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader>Complete Your Reservation</DrawerHeader>
        <DrawerBody>
          {step === 1 && (
            <form onSubmit={handleInfoSubmit}>
              <VStack spacing={4}>
                <FormControl isRequired>
                  <FormLabel>First Name</FormLabel>
                  <Input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="Enter your first name"
                    isDisabled={isProcessing}
                  />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Last Name</FormLabel>
                  <Input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="Enter your last name"
                    isDisabled={isProcessing}
                  />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Email</FormLabel>
                  <Input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Enter your email"
                    isDisabled={isProcessing}
                  />
                </FormControl>
                <Box>
                  <Text mb={4}>
                    Thank you for your reservation. To hold your reservation we request a hold on the credit card. 
                    This will be released upon your arrival.
                  </Text>
                  <Text fontSize="xl" color="blue.700" fontWeight="bold" mb={4}>
                    Hold Amount: ${holdAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' }).replace('$','')}
                  </Text>
                </Box>
                {error && (
                  <Text color="red.500">{error}</Text>
                )}
              </VStack>
            </form>
          )}
          {step === 2 && clientSecret && (
            <Elements stripe={stripePromise} options={{ clientSecret: clientSecret }}>
              <PaymentStep />
            </Elements>
          )}
        </DrawerBody>
        <DrawerFooter>
          {step === 1 && (
            <Box display="flex" justifyContent="flex-end" gap={4} w="full">
              <Button onClick={onCancel} isDisabled={isProcessing} variant="ghost">
                Cancel
              </Button>
              <Button
                onClick={handleInfoSubmit}
                colorScheme="blue"
                isLoading={isProcessing}
                loadingText="Processing..."
              >
                Continue to Payment
              </Button>
            </Box>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default CreditCardHoldDrawer; 