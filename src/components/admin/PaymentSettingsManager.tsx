import React, { useState, useEffect } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  FormControl,
  FormLabel,
  Input,
  InputGroup,
  InputLeftAddon,
  Select,
  Card,
  CardBody,
  CardHeader,
  useToast,
  Spinner,
  Alert,
  AlertIcon,
  Divider
} from '@chakra-ui/react';

interface PaymentSettings {
  id: string;
  membership_fee: number;
  currency: string;
  stripe_price_id?: string;
  is_active: boolean;
  created_at: string;
}

export default function PaymentSettingsManager() {
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    membership_fee: 10000, // $100.00 in cents
    currency: 'usd',
    stripe_price_id: ''
  });
  const toast = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // This would need to be implemented
      const response = await fetch('/api/membership/payment-settings');
      if (response.ok) {
        const data = await response.json();
        if (data) {
          setSettings(data);
          setFormData({
            membership_fee: data.membership_fee,
            currency: data.currency,
            stripe_price_id: data.stripe_price_id || ''
          });
        }
      }
    } catch (error) {
      console.error('Error loading payment settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // This would need to be implemented
      const response = await fetch('/api/membership/payment-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Payment settings updated successfully',
          status: 'success',
          duration: 3000,
        });
        loadSettings();
      } else {
        throw new Error('Failed to update settings');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update payment settings',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setSaving(false);
    }
  };

  const formatAmount = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: formData.currency.toUpperCase()
    }).format(cents / 100);
  };

  if (loading) {
    return (
      <VStack spacing={4} py={8}>
        <Spinner size="lg" />
        <Text>Loading payment settings...</Text>
      </VStack>
    );
  }

  return (
    <VStack spacing={6} align="stretch">
      <VStack align="start" spacing={1}>
        <Text fontSize="lg" fontWeight="bold">
          Payment Settings
        </Text>
        <Text fontSize="sm" color="gray.600">
          Configure membership fees and Stripe integration settings
        </Text>
      </VStack>

      <Card>
        <CardHeader>
          <Text fontSize="md" fontWeight="bold">Membership Fee Configuration</Text>
        </CardHeader>
        <CardBody>
          <VStack spacing={6} align="stretch">
            <HStack spacing={4} align="end">
              <FormControl flex={2}>
                <FormLabel>Membership Fee</FormLabel>
                <InputGroup>
                  <InputLeftAddon>$</InputLeftAddon>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.membership_fee / 100}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      membership_fee: Math.round(parseFloat(e.target.value || '0') * 100)
                    }))}
                    placeholder="100.00"
                  />
                </InputGroup>
              </FormControl>

              <FormControl flex={1}>
                <FormLabel>Currency</FormLabel>
                <Select
                  value={formData.currency}
                  onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                >
                  <option value="usd">USD</option>
                  <option value="eur">EUR</option>
                  <option value="gbp">GBP</option>
                  <option value="cad">CAD</option>
                  <option value="aud">AUD</option>
                </Select>
              </FormControl>
            </HStack>

            <Alert status="info" size="sm">
              <AlertIcon />
              <VStack align="start" spacing={1}>
                <Text fontWeight="bold" fontSize="sm">
                  Current fee: {formatAmount(formData.membership_fee)}
                </Text>
                <Text fontSize="xs">
                  This is the one-time membership application fee that users will pay.
                </Text>
              </VStack>
            </Alert>
          </VStack>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <Text fontSize="md" fontWeight="bold">Stripe Integration</Text>
        </CardHeader>
        <CardBody>
          <VStack spacing={4} align="stretch">
            <FormControl>
              <FormLabel>Stripe Price ID (Optional)</FormLabel>
              <Input
                value={formData.stripe_price_id}
                onChange={(e) => setFormData(prev => ({ ...prev, stripe_price_id: e.target.value }))}
                placeholder="price_1234567890abcdef"
              />
              <Text fontSize="xs" color="gray.500" mt={1}>
                If provided, this Stripe Price ID will be used for recurring billing
              </Text>
            </FormControl>

            <Alert status="warning" size="sm">
              <AlertIcon />
              <VStack align="start" spacing={1}>
                <Text fontWeight="bold" fontSize="sm">
                  Stripe Configuration Required
                </Text>
                <Text fontSize="xs">
                  Ensure your Stripe API keys are configured in environment variables:
                  STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
                </Text>
              </VStack>
            </Alert>
          </VStack>
        </CardBody>
      </Card>

      <Divider />

      <HStack justify="space-between">
        <Text fontSize="sm" color="gray.500">
          {settings ? `Last updated: ${new Date(settings.created_at).toLocaleDateString()}` : 'Not configured'}
        </Text>
        
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
  );
}