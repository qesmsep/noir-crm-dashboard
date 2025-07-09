import React, { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardBody,
  Heading,
  VStack,
  FormControl,
  FormLabel,
  Input,
  Switch,
  Textarea,
  Button,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Text,
  useToast
} from '@chakra-ui/react';
import { getSupabaseClient } from '../pages/api/supabaseClient';

interface LedgerNotificationSettings {
  id: string;
  is_enabled: boolean;
  send_time: string;
  days_before_renewal: number;
  message_template: string;
  created_at: string;
  updated_at: string;
}

const LedgerNotificationSettingsCard: React.FC = () => {
  const [settings, setSettings] = useState<LedgerNotificationSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data: settingsData, error: settingsError } = await getSupabaseClient()
        .from('ledger_notification_settings')
        .select('*')
        .eq('is_enabled', true)
        .single();
      if (settingsError && settingsError.code !== 'PGRST116') {
        console.error('Error fetching settings:', settingsError);
      } else if (settingsData) {
        setSettings(settingsData);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    try {
      setSaving(true);
      const { error } = await getSupabaseClient()
        .from('ledger_notification_settings')
        .upsert(settings);
      if (error) {
        throw error;
      }
      toast({
        title: 'Settings saved',
        description: 'Ledger notification settings have been updated.',
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save settings.',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card mb={8} bg="white" shadow="sm" border="1px solid" borderColor="gray.200">
      <CardHeader>
        <Heading size="md">Ledger Notification Settings</Heading>
      </CardHeader>
      <CardBody>
        {settings ? (
          <VStack spacing={4} align="stretch">
            <FormControl display="flex" alignItems="center">
              <FormLabel htmlFor="is_enabled" mb="0">
                Enable Ledger Notifications
              </FormLabel>
              <Switch
                id="is_enabled"
                isChecked={settings.is_enabled}
                onChange={(e) => setSettings({ ...settings, is_enabled: e.target.checked })}
              />
            </FormControl>
            <FormControl>
              <FormLabel>Send Time</FormLabel>
              <Input
                type="time"
                value={settings.send_time}
                onChange={(e) => setSettings({ ...settings, send_time: e.target.value })}
              />
            </FormControl>
            <FormControl>
              <FormLabel>Days Before Renewal</FormLabel>
              <Input
                type="number"
                value={settings.days_before_renewal}
                onChange={(e) => setSettings({ ...settings, days_before_renewal: parseInt(e.target.value) })}
                min={1}
                max={30}
              />
            </FormControl>
            <FormControl>
              <FormLabel>Message Template</FormLabel>
              <Textarea
                value={settings.message_template}
                onChange={(e) => setSettings({ ...settings, message_template: e.target.value })}
                placeholder="Enter message template with placeholders: {{first_name}}, {{renewal_date}}"
                rows={4}
              />
              <Text fontSize="sm" color="gray.600" mt={2}>
                Available placeholders: {'{{first_name}}'}, {'{{renewal_date}}'}
              </Text>
            </FormControl>
            <Button
              colorScheme="blue"
              onClick={handleSaveSettings}
              isLoading={saving}
              loadingText="Saving..."
            >
              Save Settings
            </Button>
          </VStack>
        ) : (
          <Alert status="warning">
            <AlertIcon />
            <AlertTitle>No settings found!</AlertTitle>
            <AlertDescription>
              Please run the database migration to create the default settings.
            </AlertDescription>
          </Alert>
        )}
      </CardBody>
    </Card>
  );
};

export default LedgerNotificationSettingsCard; 