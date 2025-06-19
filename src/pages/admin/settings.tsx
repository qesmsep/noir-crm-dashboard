import React, { useEffect, useState } from 'react';
import AdminLayout from '@/components/layouts/AdminLayout';
import { supabase } from '@/lib/supabase';
import styles from '@/styles/Settings.module.css';
import CalendarAvailabilityControl from '@/components/CalendarAvailabilityControl';
import { Box, Heading, VStack, useColorModeValue } from "@chakra-ui/react";

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
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .single();

      if (error) throw error;

      if (data) {
        setSettings(data as Settings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      setMessage({
        type: 'error',
        text: 'Failed to load settings. Using default values.',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('settings')
        .upsert(settings, { onConflict: 'id' });

      if (error) throw error;

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
      <Box p={{ base: 4, md: 8 }}>
        <Heading mb={8} fontSize="2xl" fontWeight="bold" color="gray.800">Settings</Heading>
        <VStack spacing={8} align="stretch">
          <Box bg={useColorModeValue('white', 'gray.800')} borderRadius="lg" boxShadow="md" p={6}>
            <div className={styles.section}>
              <div className={styles.formGroup}>
                <label htmlFor="business_name">Business Name</label>
                <input
                  type="text"
                  id="business_name"
                  value={settings.business_name}
                  onChange={(e) =>
                    handleInputChange('business_name', '', e.target.value)
                  }
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="business_email">Business Email</label>
                <input
                  type="email"
                  id="business_email"
                  value={settings.business_email}
                  onChange={(e) =>
                    handleInputChange('business_email', '', e.target.value)
                  }
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="business_phone">Business Phone</label>
                <input
                  type="tel"
                  id="business_phone"
                  value={settings.business_phone}
                  onChange={(e) =>
                    handleInputChange('business_phone', '', e.target.value)
                  }
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="address">Address</label>
                <textarea
                  id="address"
                  value={settings.address}
                  onChange={(e) =>
                    handleInputChange('address', '', e.target.value)
                  }
                />
              </div>
            </div>
          </Box>
          <Box bg={useColorModeValue('white', 'gray.800')} borderRadius="lg" boxShadow="md" p={6}>
            <div className={styles.section}>
              <div style={{ marginBottom: '2rem' }}>
                <strong>Booking Window</strong>
                <div style={{ marginTop: '1rem' }}>
                  <CalendarAvailabilityControl section="booking_window" />
                </div>
              </div>
              <div style={{ marginBottom: '2rem' }}>
                <strong>Base Hours</strong>
                <div style={{ marginTop: '1rem' }}>
                  <CalendarAvailabilityControl section="base" />
                </div>
              </div>
              <div style={{ marginBottom: '2rem' }}>
                <strong>Custom Open Days</strong>
                <div style={{ marginTop: '1rem' }}>
                  <CalendarAvailabilityControl section="custom_open" />
                </div>
              </div>
              <div style={{ marginBottom: '2rem' }}>
                <strong>Custom Closed Days</strong>
                <div style={{ marginTop: '1rem' }}>
                  <CalendarAvailabilityControl section="custom_closed" />
                </div>
              </div>
              <div style={{ marginBottom: '2rem' }}>
                <strong>Private Events</strong>
                <div style={{ marginTop: '1rem' }}>
                  <CalendarAvailabilityControl section="private_events" />
                </div>
              </div>
            </div>
          </Box>
        </VStack>
      </Box>
    </AdminLayout>
  );
} 