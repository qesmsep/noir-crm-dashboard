import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Heading,
  FormControl,
  FormLabel,
  Input,
  Select,
  Checkbox,
  useToast,
  Card,
  CardBody,
  Alert,
  AlertIcon
} from '@chakra-ui/react';

interface PaymentSettings {
  id: string;
  membership_fee: number;
  currency: string;
  stripe_price_id?: string;
  is_active: boolean;
}

export default function PaymentSettingsManager() {
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/membership/payment');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load payment settings',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const response = await fetch('/api/membership/payment', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Payment settings saved successfully',
          status: 'success',
          duration: 3000,
        });
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save payment settings',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setSaving(false);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount / 100);
  };

  if (loading) {
    return <Text>Loading payment settings...</Text>;
  }

  return (
    <VStack spacing={6} align="stretch">
      <VStack align="start" spacing={1}>
        <Heading size="md">Payment Settings</Heading>
        <Text fontSize="sm" color="gray.600">
          Configure membership fees and payment processing
        </Text>
      </VStack>

      <Card bg="white" border="1px" borderColor="gray.300">
        <CardBody>
          <VStack spacing={6} align="stretch">
            <Alert status="info" bg="blue.50" border="1px" borderColor="blue.200">
              <AlertIcon />
              <Text fontSize="sm" color="#353535">
                These settings control the membership application fee and payment processing configuration.
              </Text>
            </Alert>

            <FormControl>
              <FormLabel color="#353535">Membership Fee (in cents)</FormLabel>
              <Input
                type="number"
                value={settings?.membership_fee || 0}
                onChange={(e) => setSettings(prev => ({ ...prev!, membership_fee: parseInt(e.target.value) || 0 }))}
                placeholder="10000 for $100.00"
                bg="white"
                borderColor="gray.300"
                _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px #3182ce" }}
              />
              <Text fontSize="sm" color="gray.500">
                Current fee: {formatAmount(settings?.membership_fee || 0)}
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel color="#353535">Currency</FormLabel>
              <Select
                value={settings?.currency || 'usd'}
                onChange={(e) => setSettings(prev => ({ ...prev!, currency: e.target.value }))}
                bg="white"
                borderColor="gray.300"
                _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px #3182ce" }}
              >
                <option value="usd">USD - US Dollar</option>
                <option value="eur">EUR - Euro</option>
                <option value="gbp">GBP - British Pound</option>
                <option value="cad">CAD - Canadian Dollar</option>
              </Select>
            </FormControl>

            <FormControl>
              <FormLabel color="#353535">Stripe Price ID (Optional)</FormLabel>
              <Input
                value={settings?.stripe_price_id || ''}
                onChange={(e) => setSettings(prev => ({ ...prev!, stripe_price_id: e.target.value }))}
                placeholder="price_1234567890"
                bg="white"
                borderColor="gray.300"
                _focus={{ borderColor: "blue.500", boxShadow: "0 0 0 1px #3182ce" }}
              />
              <Text fontSize="sm" color="gray.500">
                If you have a specific Stripe price ID, enter it here. Otherwise, a new price will be created.
              </Text>
            </FormControl>

            <FormControl>
              <Checkbox
                isChecked={settings?.is_active ?? true}
                onChange={(e) => setSettings(prev => ({ ...prev!, is_active: e.target.checked }))}
                color="#353535"
              >
                Active
              </Checkbox>
              <Text fontSize="sm" color="gray.500">
                When inactive, new applications cannot be processed
              </Text>
            </FormControl>

            <HStack justify="end">
              <Button
                colorScheme="blue"
                onClick={handleSave}
                isLoading={saving}
                loadingText="Saving..."
              >
                Save Settings
              </Button>
            </HStack>
          </VStack>
        </CardBody>
      </Card>
    </VStack>
  );
} 