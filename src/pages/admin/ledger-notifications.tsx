import React, { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  VStack,
  HStack,
  Text,
  Button,
  FormControl,
  FormLabel,
  Input,
  Switch,
  Textarea,
  useToast,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  SimpleGrid
} from '@chakra-ui/react';
import { getSupabaseClient } from '../api/supabaseClient';
import AdminLayout from '../../components/layouts/AdminLayout';

interface LedgerNotificationSettings {
  id: string;
  is_enabled: boolean;
  send_time: string;
  days_before_renewal: number;
  message_template: string;
  created_at: string;
  updated_at: string;
}

interface ScheduledNotification {
  id: string;
  member_id: string;
  account_id: string;
  renewal_date: string;
  ledger_start_date: string;
  ledger_end_date: string;
  scheduled_for: string;
  sent_at?: string;
  status: 'pending' | 'sent' | 'failed';
  pdf_url?: string;
  sms_message_id?: string;
  error_message?: string;
  created_at: string;
  members: {
    first_name: string;
    last_name: string;
    phone: string;
  };
}

export default function LedgerNotificationsPage() {
  const [settings, setSettings] = useState<LedgerNotificationSettings | null>(null);
  const [scheduledNotifications, setScheduledNotifications] = useState<ScheduledNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    sent: 0,
    failed: 0
  });
  const toast = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch settings
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

      // Fetch scheduled notifications
      const { data: notificationsData, error: notificationsError } = await getSupabaseClient()
        .from('scheduled_ledger_notifications')
        .select(`
          *,
          members (
            first_name,
            last_name,
            phone
          )
        `)
        .order('scheduled_for', { ascending: false })
        .limit(50);

      if (notificationsError) {
        console.error('Error fetching notifications:', notificationsError);
      } else if (notificationsData) {
        setScheduledNotifications(notificationsData);
        
        // Calculate stats
        const stats = {
          total: notificationsData.length,
          pending: notificationsData.filter(n => n.status === 'pending').length,
          sent: notificationsData.filter(n => n.status === 'sent').length,
          failed: notificationsData.filter(n => n.status === 'failed').length
        };
        setStats(stats);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
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

  const handleScheduleNotifications = async () => {
    try {
      setScheduling(true);
      
      const response = await fetch('/api/schedule-ledger-notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to schedule notifications');
      }

      toast({
        title: 'Notifications scheduled',
        description: `Scheduled ${result.scheduled_count} notifications.`,
        status: 'success',
        duration: 3000,
      });

      // Refresh data
      await fetchData();
    } catch (error) {
      console.error('Error scheduling notifications:', error);
      toast({
        title: 'Error',
        description: 'Failed to schedule notifications.',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setScheduling(false);
    }
  };

  const handleProcessNotifications = async () => {
    try {
      setProcessing(true);
      
      const response = await fetch('/api/process-ledger-notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to process notifications');
      }

      toast({
        title: 'Notifications processed',
        description: `Processed ${result.processed} notifications: ${result.successful} successful, ${result.failed} failed.`,
        status: 'success',
        duration: 5000,
      });

      // Refresh data
      await fetchData();
    } catch (error) {
      console.error('Error processing notifications:', error);
      toast({
        title: 'Error',
        description: 'Failed to process notifications.',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'yellow';
      case 'sent': return 'green';
      case 'failed': return 'red';
      default: return 'gray';
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <Box p={8}>
          <Spinner size="xl" />
        </Box>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Box p={8}>
        <Heading size="lg" mb={6} fontFamily="IvyJournal-Thin, serif">
          Ledger Notifications
        </Heading>

        {/* Stats */}
        <SimpleGrid columns={{ base: 1, md: 4 }} spacing={6} mb={8}>
          <Stat>
            <StatLabel>Total Notifications</StatLabel>
            <StatNumber>{stats.total}</StatNumber>
          </Stat>
          <Stat>
            <StatLabel>Pending</StatLabel>
            <StatNumber color="yellow.500">{stats.pending}</StatNumber>
          </Stat>
          <Stat>
            <StatLabel>Sent</StatLabel>
            <StatNumber color="green.500">{stats.sent}</StatNumber>
          </Stat>
          <Stat>
            <StatLabel>Failed</StatLabel>
            <StatNumber color="red.500">{stats.failed}</StatNumber>
          </Stat>
        </SimpleGrid>

        {/* Settings Card */}
        <Card mb={8}>
          <CardHeader>
            <Heading size="md">Notification Settings</Heading>
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

        {/* Actions Card */}
        <Card mb={8}>
          <CardHeader>
            <Heading size="md">Actions</Heading>
          </CardHeader>
          <CardBody>
            <HStack spacing={4}>
              <Button
                colorScheme="green"
                onClick={handleScheduleNotifications}
                isLoading={scheduling}
                loadingText="Scheduling..."
              >
                Schedule Notifications
              </Button>
              <Button
                colorScheme="blue"
                onClick={handleProcessNotifications}
                isLoading={processing}
                loadingText="Processing..."
              >
                Process Pending Notifications
              </Button>
              <Button
                variant="outline"
                onClick={fetchData}
              >
                Refresh Data
              </Button>
            </HStack>
          </CardBody>
        </Card>

        {/* Scheduled Notifications Table */}
        <Card>
          <CardHeader>
            <Heading size="md">Scheduled Notifications</Heading>
          </CardHeader>
          <CardBody>
            {scheduledNotifications.length > 0 ? (
              <Box overflowX="auto">
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th>Member</Th>
                      <Th>Renewal Date</Th>
                      <Th>Ledger Period</Th>
                      <Th>Scheduled For</Th>
                      <Th>Status</Th>
                      <Th>Sent At</Th>
                      <Th>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {scheduledNotifications.map((notification) => (
                      <Tr key={notification.id}>
                        <Td>
                          {notification.members.first_name} {notification.members.last_name}
                        </Td>
                        <Td>{new Date(notification.renewal_date).toLocaleDateString()}</Td>
                        <Td>
                          {new Date(notification.ledger_start_date).toLocaleDateString()} - {new Date(notification.ledger_end_date).toLocaleDateString()}
                        </Td>
                        <Td>{formatDate(notification.scheduled_for)}</Td>
                        <Td>
                          <Badge colorScheme={getStatusColor(notification.status)}>
                            {notification.status}
                          </Badge>
                        </Td>
                        <Td>
                          {notification.sent_at ? formatDate(notification.sent_at) : '-'}
                        </Td>
                        <Td>
                          {notification.pdf_url && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(notification.pdf_url, '_blank')}
                            >
                              View PDF
                            </Button>
                          )}
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </Box>
            ) : (
              <Text>No scheduled notifications found.</Text>
            )}
          </CardBody>
        </Card>
      </Box>
    </AdminLayout>
  );
} 