import React, { useState, useEffect } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import {
  Box,
  Button,
  Flex,
  Heading,
  Text,
  VStack,
  HStack,
  Badge,
  Spinner,
  IconButton,
  useToast,
  CloseButton,
} from '@chakra-ui/react';

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
}

interface PaymentMethodsProps {
  account_id: string;
  onClose: () => void;
}

const PaymentMethods: React.FC<PaymentMethodsProps> = ({ account_id, onClose }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddCard, setShowAddCard] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (account_id) {
      fetchPaymentMethods();
    }
    // eslint-disable-next-line
  }, [account_id]);

  const fetchPaymentMethods = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/listPaymentMethods?account_id=${account_id}`);
      if (!response.ok) throw new Error('Failed to fetch payment methods');
      const data = await response.json();
      setPaymentMethods(data.payment_methods);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (paymentMethodId: string) => {
    try {
      const response = await fetch('/api/setDefaultPaymentMethod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id, payment_method_id: paymentMethodId }),
      });
      if (!response.ok) throw new Error('Failed to set default payment method');
      await fetchPaymentMethods();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAddCard = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setCardError(null);
    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: elements.getElement(CardElement)!,
    });
    if (error) {
      setCardError(error.message || '');
      setProcessing(false);
      return;
    }
    try {
      const response = await fetch('/api/setupPaymentMethod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id,
          payment_method_id: paymentMethod.id,
        }),
      });
      if (!response.ok) throw new Error('Failed to add payment method');
      await fetchPaymentMethods();
      setShowAddCard(false);
      elements.getElement(CardElement)?.clear();
      toast({ title: 'Card added', status: 'success', duration: 3000 });
    } catch (err: any) {
      setCardError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <Flex justify="center" align="center" py={8}>
        <Spinner size="lg" />
        <Text ml={4}>Loading payment methods...</Text>
      </Flex>
    );
  }

  return (
    <Box bg="white" rounded="lg" shadow="lg" p={6} maxW="2xl" mx="auto">
      <Flex justify="space-between" align="center" mb={6}>
        <Heading size="md">Payment Methods</Heading>
        <CloseButton onClick={onClose} />
      </Flex>
      {error && (
        <Box bg="red.50" color="red.700" p={4} rounded="lg" mb={6}>
          {error}
        </Box>
      )}
      <VStack spacing={4} align="stretch">
        {paymentMethods.map((method) => (
          <Flex key={method.id} align="center" justify="space-between" p={4} borderWidth={1} rounded="lg">
            <HStack spacing={4} align="center">
              <Text color="gray.600">{method.brand.toUpperCase()} •••• {method.last4}</Text>
              <Text fontSize="sm" color="gray.500">Expires {method.exp_month}/{method.exp_year}</Text>
              {method.is_default && (
                <Badge colorScheme="green">Default</Badge>
              )}
            </HStack>
            {!method.is_default && (
              <Button size="sm" colorScheme="blue" variant="link" onClick={() => handleSetDefault(method.id)}>
                Set as Default
              </Button>
            )}
          </Flex>
        ))}
        {showAddCard ? (
          <Box as="form" onSubmit={handleAddCard}>
            <Box borderWidth={1} rounded="lg" p={4} mb={2}>
              <CardElement
                options={{
                  style: {
                    base: {
                      fontSize: '16px',
                      color: '#424770',
                      '::placeholder': { color: '#aab7c4' },
                    },
                    invalid: { color: '#9e2146' },
                  },
                }}
              />
            </Box>
            {cardError && <Text color="red.600" fontSize="sm">{cardError}</Text>}
            <Flex justify="flex-end" gap={4} mt={2}>
              <Button type="button" onClick={() => setShowAddCard(false)} colorScheme="gray" isDisabled={processing}>
                Cancel
              </Button>
              <Button type="submit" colorScheme="blue" isLoading={processing} isDisabled={!stripe || processing}>
                {processing ? 'Adding...' : 'Add Card'}
              </Button>
            </Flex>
          </Box>
        ) : (
          <Button
            onClick={() => setShowAddCard(true)}
            w="full"
            colorScheme="blue"
            variant="outline"
          >
            + Add New Card
          </Button>
        )}
      </VStack>
    </Box>
  );
};

export default PaymentMethods; 