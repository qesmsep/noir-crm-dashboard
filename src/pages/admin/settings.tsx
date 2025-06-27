import React, { useEffect, useState } from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { supabase } from '@/lib/supabase';
import styles from '@/styles/Settings.module.css';
import CalendarAvailabilityControl from '@/components/CalendarAvailabilityControl';
import PrivateEventsManager from '@/components/PrivateEventsManager';
import { Box, Heading, VStack, useColorModeValue, Text, Input, Button } from "@chakra-ui/react";
import { useSettings } from '@/context/SettingsContext';

interface Settings {
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
}

const defaultSettings: Settings = {
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
};

export default function Settings() {
  const { settings: contextSettings, refreshSettings } = useSettings();
  const [settings, setSettings] = useState<Settings>(contextSettings);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setSettings(contextSettings);
  }, [contextSettings]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('settings')
        .upsert(settings, { onConflict: 'id' });

      if (error) throw error;

      await refreshSettings();
      setMessage({
        type: 'success',
        text: 'Settings saved successfully.',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({
        type: 'error',
        text: 'Failed to save settings.',
      });
    } finally {
      setSaving(false);
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
        </VStack>
      </Box>
    </AdminLayout>
  );
} 