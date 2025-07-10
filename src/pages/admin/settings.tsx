import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/layouts/AdminLayout';
import { supabaseAdmin } from '../../lib/supabase';
import styles from '../../styles/Settings.module.css';
import CalendarAvailabilityControl from '../../components/CalendarAvailabilityControl';
import PrivateEventsManager from '../../components/PrivateEventsManager';
import { Box, Heading, VStack, useColorModeValue, Text, Input, Button, Switch, FormControl, FormLabel, NumberInput, NumberInputField, NumberInputStepper, NumberIncrementStepper, NumberDecrementStepper, HStack } from "@chakra-ui/react";
import { useSettings } from '../../context/SettingsContext';
import LedgerNotificationSettingsCard from '../../components/LedgerNotificationSettingsCard';

interface Settings {
  id: string;
  business_name: string;
  business_email: string;
  business_phone: string;
  address: string;
  timezone: string;
  operating_hours: {
    [key: string]: { open: string; close: string };
  };
  reservation_settings: {
    max_guests: number;
    min_notice_hours: number;
    max_advance_days: number;
  };
  notification_settings: {
    email_notifications: boolean;
    sms_notifications: boolean;
    notification_email: string;
  };
  hold_fee_enabled: boolean;
  hold_fee_amount: number;
  admin_notification_phone: string;
}

const defaultSettings: Settings = {
  id: '',
  business_name: '',
  business_email: '',
  business_phone: '',
  address: '',
  timezone: 'UTC',
  operating_hours: {
    monday: { open: '09:00', close: '17:00' },
    tuesday: { open: '09:00', close: '17:00' },
    wednesday: { open: '09:00', close: '17:00' },
    thursday: { open: '09:00', close: '17:00' },
    friday: { open: '09:00', close: '17:00' },
    saturday: { open: '10:00', close: '15:00' },
    sunday: { open: '10:00', close: '15:00' },
  },
  reservation_settings: {
    max_guests: 10,
    min_notice_hours: 24,
    max_advance_days: 30,
  },
  notification_settings: {
    email_notifications: true,
    sms_notifications: false,
    notification_email: '',
  },
  hold_fee_enabled: true,
  hold_fee_amount: 25.00,
  admin_notification_phone: '',
};

export default function Settings() {
  const { settings: contextSettings, refreshSettings, refreshHoldFeeSettings } = useSettings();
  const [settings, setSettings] = useState<Settings>(contextSettings);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [holdFeeSaving, setHoldFeeSaving] = useState(false);
  const [holdFeeMessage, setHoldFeeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setSettings(contextSettings);
  }, [contextSettings]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      if (settings.id) {
        // Update or upsert the existing row
        const { error } = await supabaseAdmin
          .from('settings')
          .upsert(settings, { onConflict: 'id' });
        if (error) throw error;
      } else {
        // Only insert if no row exists
        const response = await fetch('/api/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(settings),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create initial settings');
        }
        const newSettings = await response.json();
        setSettings(prev => ({ ...prev, id: newSettings.id }));
      }
      await refreshSettings();
      setMessage({
        type: 'success',
        text: 'Settings saved successfully.',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save settings.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleHoldFeeSave() {
    setHoldFeeSaving(true);
    setHoldFeeMessage(null);
    try {
      if (settings.id) {
        // Update or upsert the existing row
        const { error } = await supabaseAdmin
          .from('settings')
          .upsert({
            ...settings,
            hold_fee_enabled: settings.hold_fee_enabled,
            hold_fee_amount: settings.hold_fee_amount
          }, { onConflict: 'id' });
        if (error) throw error;
      } else {
        // Only insert if no row exists
        const response = await fetch('/api/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...settings,
            hold_fee_enabled: settings.hold_fee_enabled,
            hold_fee_amount: settings.hold_fee_amount
          }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create initial settings');
        }
        const newSettings = await response.json();
        setSettings(prev => ({ ...prev, id: newSettings.id }));
      }
      await Promise.all([refreshSettings(), refreshHoldFeeSettings()]);
      setHoldFeeMessage({ type: 'success', text: 'Hold fee settings saved successfully.' });
    } catch (error) {
      console.error('Error saving hold fee settings:', error);
      setHoldFeeMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save hold fee settings.'
      });
    } finally {
      setHoldFeeSaving(false);
    }
  }

  const handleInputChange = (
    section: keyof Settings,
    field: string,
    value: any
  ) => {
    setSettings((prev) => ({
      ...prev,
      [section]:
        typeof prev[section] === 'object'
          ? { ...prev[section], [field]: value }
          : value,
    }));
  };

  if (loading) {
    return (
      <AdminLayout>
        <Box className={styles.loading}>Loading settings...</Box>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Box p={{ base: 4, md: 8 }} bg="weddingDay" minH="100vh">
        <Heading mb={8} fontSize="2xl" fontWeight="bold" color="nightSky">Settings</Heading>
        
        {message && (
          <Box
            mb={6}
            p={4}
            borderRadius="lg"
            bg={message.type === 'success' ? 'green.50' : 'red.50'}
            color={message.type === 'success' ? 'green.700' : 'red.700'}
            border="1px solid"
            borderColor={message.type === 'success' ? 'green.200' : 'red.200'}
          >
            {message.text}
          </Box>
        )}

        <VStack spacing={6} align="stretch">
          {/* Save Button */}
          <Box display="flex" justifyContent="flex-end">
            <Button
              onClick={handleSave}
              isLoading={saving}
              loadingText="Saving..."
              colorScheme="blue"
              size="lg"
            >
              Save Settings
            </Button>
          </Box>

          {/* Booking Window Card */}
          <Box 
            bg="white" 
            borderRadius="2xl" 
            boxShadow="0 2px 8px rgba(0,0,0,0.07)" 
            p={6}
            border="1px solid"
            borderColor="gray.100"
          >
            <Heading size="md" mb={4} color="nightSky" fontWeight="600">
              Booking Window
            </Heading>
            <CalendarAvailabilityControl section="booking_window" />
          </Box>

          {/* Ledger Notification Settings Card */}
          <LedgerNotificationSettingsCard />

          {/* Base Hours Card */}
          <Box 
            bg="white" 
            borderRadius="2xl" 
            boxShadow="0 2px 8px rgba(0,0,0,0.07)" 
            p={6}
            border="1px solid"
            borderColor="gray.100"
          >
            <Heading size="md" mb={4} color="nightSky" fontWeight="600">
              Base Hours
            </Heading>
            <CalendarAvailabilityControl section="base" />
          </Box>

          {/* Custom Open/Closed Days Card */}
          <Box 
            bg="white" 
            borderRadius="2xl" 
            boxShadow="0 2px 8px rgba(0,0,0,0.07)" 
            p={6}
            border="1px solid"
            borderColor="gray.100"
          >
            <Heading size="md" mb={4} color="nightSky" fontWeight="600">
              Custom Open/Closed Days
            </Heading>
            <VStack spacing={6} align="stretch">
              <Box>
                <Text fontWeight="500" mb={3} color="gray.700">Custom Open Days</Text>
                <CalendarAvailabilityControl section="custom_open" />
              </Box>
              <Box>
                <Text fontWeight="500" mb={3} color="gray.700">Custom Closed Days</Text>
                <CalendarAvailabilityControl section="custom_closed" />
              </Box>
            </VStack>
          </Box>

          {/* Timezone Card */}
          <Box 
            bg="white"
            borderRadius="2xl"
            boxShadow="0 2px 8px rgba(0,0,0,0.07)"
            p={6}
            border="1px solid"
            borderColor="gray.100"
          >
            <Heading size="md" mb={4} color="nightSky" fontWeight="600">
              Timezone
            </Heading>
            <Input
              value={settings.timezone}
              onChange={(e) => handleInputChange('timezone', '', e.target.value)}
              placeholder="e.g., America/Chicago"
            />
            <Text fontSize="sm" color="gray.500" mt={2}>
              Enter IANA timezone, e.g., America/Chicago, America/New_York, Europe/London
            </Text>
          </Box>

          {/* Private Events Card */}
          <Box 
            bg="white" 
            borderRadius="2xl" 
            boxShadow="0 2px 8px rgba(0,0,0,0.07)" 
            p={6}
            border="1px solid"
            borderColor="gray.100"
          >
            <PrivateEventsManager />
          </Box>

          {/* Admin Notification Settings Card */}
          <Box 
            bg="white" 
            borderRadius="2xl" 
            boxShadow="0 2px 8px rgba(0,0,0,0.07)" 
            p={6}
            border="1px solid"
            borderColor="gray.100"
          >
            <Heading size="md" mb={4} color="nightSky" fontWeight="600">
              Admin Notifications
            </Heading>
            <VStack spacing={4} align="stretch">
              <FormControl>
                <FormLabel fontWeight="500" color="gray.700">
                  Admin Notification Phone Number
                </FormLabel>
                <Input
                  value={typeof settings.admin_notification_phone === 'string' ? settings.admin_notification_phone : ''}
                  onChange={(e) => handleInputChange('admin_notification_phone', '', e.target.value)}
                  placeholder="9137774488"
                  bg="white"
                  color="#23201C"
                  fontFamily="'Montserrat', sans-serif"
                />
                <Text fontSize="sm" color="gray.500" mt={2}>
                  Phone number for SMS notifications when reservations are created or modified. 
                  The system will automatically add +1 prefix.
                </Text>
                <Text fontSize="sm" color="gray.700" mt={2}>
                  <b>Current notification phone on file:</b> {typeof contextSettings.admin_notification_phone === 'string' && contextSettings.admin_notification_phone
                    ? `+1${contextSettings.admin_notification_phone.replace(/^\+?1?/, '')}`
                    : <span style={{color: '#b91c1c'}}>Not set</span>}
                </Text>
                {/* Save button for just the phone number */}
                <Box display="flex" justifyContent="flex-end" mt={2}>
                  <Button
                    colorScheme="blue"
                    size="sm"
                    onClick={async () => {
                      try {
                        const { error } = await supabaseAdmin
                          .from('settings')
                          .upsert({ id: settings.id, admin_notification_phone: settings.admin_notification_phone }, { onConflict: 'id' });
                        if (error) throw error;
                        await refreshSettings();
                        setMessage({ type: 'success', text: 'Admin notification phone saved.' });
                      } catch (err) {
                        setMessage({ type: 'error', text: 'Failed to save admin notification phone.' });
                      }
                    }}
                  >
                    Save Phone
                  </Button>
                </Box>
                {message && (
                  <Box
                    mt={2}
                    p={2}
                    borderRadius="md"
                    bg={message.type === 'success' ? 'green.50' : 'red.50'}
                    color={message.type === 'success' ? 'green.700' : 'red.700'}
                    border="1px solid"
                    borderColor={message.type === 'success' ? 'green.200' : 'red.200'}
                  >
                    {message.text}
                  </Box>
                )}
              </FormControl>
            </VStack>
          </Box>

          {/* Hold Fee Settings Card */}
          <Box 
            bg="white" 
            borderRadius="2xl" 
            boxShadow="0 2px 8px rgba(0,0,0,0.07)" 
            p={6}
            border="1px solid"
            borderColor="gray.100"
          >
            <Heading size="md" mb={4} color="nightSky" fontWeight="600">
              Reservation Hold Fee
            </Heading>
            <VStack spacing={4} align="stretch">
              {holdFeeMessage && (
                <Box
                  mb={2}
                  p={3}
                  borderRadius="lg"
                  bg={holdFeeMessage.type === 'success' ? 'green.50' : 'red.50'}
                  color={holdFeeMessage.type === 'success' ? 'green.700' : 'red.700'}
                  border="1px solid"
                  borderColor={holdFeeMessage.type === 'success' ? 'green.200' : 'red.200'}
                >
                  {holdFeeMessage.text}
                </Box>
              )}
              <FormControl display="flex" alignItems="center">
                <FormLabel mb="0" fontWeight="500" color="gray.700">
                  {settings.hold_fee_enabled ? 'Disable Hold Fee' : 'Enable Hold Fee'}
                </FormLabel>
                <Switch
                  isChecked={settings.hold_fee_enabled}
                  onChange={(e) => handleInputChange('hold_fee_enabled', '', e.target.checked)}
                  colorScheme="green"
                />
              </FormControl>
              {settings.hold_fee_enabled && (
                <FormControl>
                  <FormLabel fontWeight="500" color="gray.700">
                    Hold Fee Amount ($)
                  </FormLabel>
                  <NumberInput
                    value={settings.hold_fee_amount}
                    onChange={(valueString) => handleInputChange('hold_fee_amount', '', parseFloat(valueString) || 0)}
                    min={0}
                    max={1000}
                    precision={2}
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                  <Text fontSize="sm" color="gray.500" mt={2}>
                    Amount to hold on credit cards for non-member reservations
                  </Text>
                </FormControl>
              )}
              <Box display="flex" justifyContent="flex-end">
                <Button
                  onClick={handleHoldFeeSave}
                  isLoading={holdFeeSaving}
                  loadingText="Saving..."
                  colorScheme="blue"
                  size="md"
                >
                  Save Hold Fee Settings
                </Button>
              </Box>
            </VStack>
          </Box>
        </VStack>
      </Box>
    </AdminLayout>
  );
} 