import React, { useState, useEffect } from 'react';
import {
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  Button,
  VStack,
  HStack,
  FormControl,
  FormLabel,
  Input,
  Select,
  Textarea,
  Text,
  Box,
  Divider,
  useToast,
  Spinner,
  Badge,
  IconButton,
  Switch,
  Alert,
  AlertIcon,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Radio,
  RadioGroup,
  Stack,
  Checkbox,
  CheckboxGroup,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  useDisclosure,
} from '@chakra-ui/react';
import { CloseIcon, DeleteIcon } from '@chakra-ui/icons';
import { useSettings } from '../context/SettingsContext';
import { InfoIcon } from '@chakra-ui/icons';

interface CampaignTemplate {
  id?: string;
  campaign_id: string; // Now a UUID string
  name: string;
  description: string;
  content: string;
  recipient_type: 'member' | 'all_members' | 'specific_phone' | 'both_members' | 'reservation_phones' | 'private_event_rsvps' | 'all_primary_members';
  specific_phone?: string;
  timing_type: 'specific_time' | 'recurring' | 'relative';
  // Specific time fields
  specific_time?: string; // HH:MM format
  specific_date?: string; // YYYY-MM-DD format
  // Recurring fields
  recurring_type?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  recurring_time?: string; // HH:MM format
  recurring_weekdays?: number[]; // Array of weekday numbers (0=Sunday, 1=Monday, etc.)
  recurring_monthly_type?: 'first' | 'last' | 'second' | 'third' | 'fourth';
  recurring_monthly_day?: 'day' | 'weekday';
  recurring_monthly_value?: number; // 1-31 for day, 1-7 for weekday
  recurring_yearly_date?: string; // MM-DD format
  // Relative fields
  relative_time?: string; // HH:MM format
  relative_quantity?: number;
  relative_unit?: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
  relative_proximity?: 'before' | 'after';
  include_ledger_pdf?: boolean; // Whether to include ledger PDF link
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  // New fields for reservation range campaigns
  reservation_range_include_past?: boolean;
  reservation_range_minute_precision?: boolean;
  // New fields for private event campaigns
  private_event_date_range?: any;
  private_event_include_old?: boolean;
  selected_private_event_id?: string;
}

interface CampaignTemplateDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  templateId?: string | null;
  isCreateMode?: boolean;
  onTemplateUpdated: () => void;
  campaignId?: string;
  isCampaignMode?: boolean;
  campaignTriggerType?: 'member_signup' | 'member_birthday' | 'member_renewal' | 'reservation_time' | 'reservation_created' | 'reservation' | 'recurring' | 'reservation_range' | 'private_event' | 'all_members';
}

const CampaignTemplateDrawer: React.FC<CampaignTemplateDrawerProps> = ({
  isOpen,
  onClose,
  templateId,
  isCreateMode = false,
  onTemplateUpdated,
  campaignId,
  isCampaignMode = false,
  campaignTriggerType,
}) => {
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const [template, setTemplate] = useState<CampaignTemplate | null>(null);
  const [formData, setFormData] = useState({
    campaign_id: '',
    name: '',
    description: '',
    content: '',
    recipient_type: 'member' as 'member' | 'all_members' | 'specific_phone' | 'both_members' | 'reservation_phones' | 'private_event_rsvps' | 'all_primary_members',
    specific_phone: '',
    timing_type: 'specific_time' as 'specific_time' | 'recurring' | 'relative',
    specific_time: '10:00',
    specific_date: '',
    recurring_type: undefined as 'daily' | 'weekly' | 'monthly' | 'yearly' | undefined,
    recurring_time: '10:00',
    recurring_weekdays: [] as number[],
    recurring_monthly_type: undefined as 'first' | 'last' | 'second' | 'third' | 'fourth' | undefined,
    recurring_monthly_day: undefined as 'day' | 'weekday' | undefined,
    recurring_monthly_value: undefined as number | undefined,
    recurring_yearly_date: undefined as string | undefined,
    relative_time: '10:00',
    relative_quantity: 1,
    relative_unit: 'day' as 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year',
    relative_proximity: 'after' as 'before' | 'after',
    include_ledger_pdf: false,
    is_active: true,
    // New fields for reservation range campaigns
    reservation_range_include_past: true,
    reservation_range_minute_precision: false,
    // New fields for private event campaigns
    private_event_date_range: undefined as any,
    private_event_include_old: false,
    selected_private_event_id: undefined as string | undefined,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [privateEvents, setPrivateEvents] = useState<any[]>([]);
  const [isLoadingPrivateEvents, setIsLoadingPrivateEvents] = useState(false);
  const [campaignData, setCampaignData] = useState<any>(null);
  const [noirMemberEvents, setNoirMemberEvents] = useState<any[]>([]);
  const toast = useToast();
  const { settings } = useSettings();

  useEffect(() => {
    if (isOpen) {
      if (isCreateMode) {
        // Reset form for create mode with campaign trigger type
        setFormData({
          campaign_id: campaignId || '',
          name: '',
          description: '',
          content: '',
          recipient_type: 'member',
          specific_phone: '',
          timing_type: 'specific_time',
          specific_time: '10:00',
          specific_date: '',
          recurring_type: undefined,
          recurring_time: '10:00',
          recurring_weekdays: [],
          recurring_monthly_type: undefined,
          recurring_monthly_day: undefined,
          recurring_monthly_value: undefined,
          recurring_yearly_date: undefined,
          relative_time: '10:00',
          relative_quantity: 1,
          relative_unit: 'day',
          relative_proximity: 'after',
          include_ledger_pdf: false,
          is_active: true,
          // New fields for reservation range campaigns
          reservation_range_include_past: true,
          reservation_range_minute_precision: false,
                  // New fields for private event campaigns
        private_event_date_range: undefined,
        private_event_include_old: false,
        selected_private_event_id: undefined,
        });
        setTemplate(null);
        setShowPreview(false);
      } else if (templateId) {
        fetchTemplate();
        setShowPreview(false);
      }
    }
  }, [isOpen, isCreateMode, templateId, campaignTriggerType]);

  // Fetch private events when drawer opens for private_event campaigns or when recipient type changes
  useEffect(() => {
    if (isOpen && (campaignTriggerType === 'private_event' || formData.recipient_type === 'private_event_rsvps')) {
      fetchPrivateEvents();
    }
  }, [isOpen, campaignTriggerType, formData.recipient_type]);

  // Fetch campaign data and noir member events when drawer opens for all_members campaigns
  useEffect(() => {
    if (isOpen && campaignTriggerType === 'all_members' && campaignId) {
      fetchCampaignData();
    }
  }, [isOpen, campaignTriggerType, campaignId]);

  const fetchTemplate = async () => {
    if (!templateId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/campaign-messages/${templateId}`);
      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 500 && errorData.error?.includes('relation "campaign_messages" does not exist')) {
          toast({
            title: 'Setup Required',
            description: 'Please run the database migration first to create the campaign messages table.',
            status: 'warning',
            duration: 5000,
          });
          onClose();
          return;
        }
        throw new Error('Failed to fetch template');
      }
      const data = await response.json();
      setTemplate(data);
      setFormData({
        campaign_id: data.campaign_id || '',
        name: data.name || '',
        description: data.description || '',
        content: data.content || '',
        recipient_type: data.recipient_type || 'member',
        specific_phone: data.specific_phone || '',
        timing_type: data.timing_type || 'specific_time',
        specific_time: data.specific_time || '10:00',
        specific_date: data.specific_date || '',
        recurring_type: data.recurring_type || undefined,
        recurring_time: data.recurring_time || '10:00',
        recurring_weekdays: data.recurring_weekdays || [],
        recurring_monthly_type: data.recurring_monthly_type || undefined,
        recurring_monthly_day: data.recurring_monthly_day || undefined,
        recurring_monthly_value: data.recurring_monthly_value || undefined,
        recurring_yearly_date: data.recurring_yearly_date || undefined,
        relative_time: data.relative_time || '10:00',
        relative_quantity: data.relative_quantity || 1,
        relative_unit: data.relative_unit || 'day',
        relative_proximity: data.relative_proximity || 'after',
        include_ledger_pdf: data.include_ledger_pdf || false,
        is_active: data.is_active !== undefined ? data.is_active : true,
        // New fields for reservation range campaigns
        reservation_range_include_past: data.reservation_range_include_past || true,
        reservation_range_minute_precision: data.reservation_range_minute_precision || false,
        // New fields for private event campaigns
        private_event_date_range: data.private_event_date_range || undefined,
        private_event_include_old: data.private_event_include_old || false,
        selected_private_event_id: data.selected_private_event_id || undefined,
      });
    } catch (error) {
      console.error('Error fetching template:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch template',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPrivateEvents = async () => {
    setIsLoadingPrivateEvents(true);
    try {
      const response = await fetch('/api/private-events');
      if (response.ok) {
        const data = await response.json();
        // Sort events chronologically by date first, then by name
        const sortedEvents = (data.data || []).sort((a: any, b: any) => {
          const dateA = new Date(a.start_time);
          const dateB = new Date(b.start_time);
          
          // First sort by date
          if (dateA.getTime() !== dateB.getTime()) {
            return dateA.getTime() - dateB.getTime();
          }
          
          // If dates are the same, sort by name
          return a.title.localeCompare(b.title);
        });
        
        setPrivateEvents(sortedEvents);
      } else {
        console.error('Failed to fetch private events');
        toast({
          title: 'Error',
          description: 'Failed to fetch private events',
          status: 'error',
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Error fetching private events:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch private events',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsLoadingPrivateEvents(false);
    }
  };

  const fetchCampaignData = async () => {
    if (!campaignId) return;
    
    try {
      // Fetch campaign data
      const campaignResponse = await fetch(`/api/campaigns/${campaignId}`);
      if (campaignResponse.ok) {
        const campaignData = await campaignResponse.json();
        setCampaignData(campaignData);
        
        // If campaign has event list enabled, fetch noir member events
        if (campaignData.include_event_list && campaignData.event_list_date_range) {
          await fetchNoirMemberEvents(campaignData.event_list_date_range);
        }
      }
    } catch (error) {
      console.error('Error fetching campaign data:', error);
    }
  };

  const fetchNoirMemberEvents = async (dateRange: any) => {
    try {
      const eventsResponse = await fetch(`/api/noir-member-events?dateRange=${encodeURIComponent(JSON.stringify(dateRange))}`);
      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json();
        setNoirMemberEvents(eventsData.events || []);
      }
    } catch (error) {
      console.error('Error fetching Noir Member Events:', error);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    console.log('=== SAVING MESSAGE TEMPLATE ===');
    console.log('Form data:', formData);
    console.log('Campaign ID:', campaignId);
    console.log('Is create mode:', isCreateMode);
    console.log('Template ID:', templateId);

    if (!formData.name.trim() || !formData.content.trim()) {
      console.log('Validation failed: Missing required fields');
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    // Log timing information for message sending
    console.log('=== MESSAGE TIMING ANALYSIS ===');
    if (formData.timing_type === 'specific_time') {
      console.log(`Message will be sent at: ${formData.specific_time} on trigger date`);
    } else if (formData.timing_type === 'recurring') {
      console.log(`Message will be sent: ${formData.recurring_type} at ${formData.recurring_time}`);
      if (formData.recurring_type === 'weekly') {
        console.log(`Selected weekdays: ${formData.recurring_weekdays?.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}`);
      } else if (formData.recurring_type === 'monthly') {
        console.log(`Monthly type: ${formData.recurring_monthly_type}, day/weekday: ${formData.recurring_monthly_day}, value: ${formData.recurring_monthly_value}`);
      } else if (formData.recurring_type === 'yearly') {
        console.log(`Yearly date: ${formData.recurring_yearly_date}`);
      }
    } else if (formData.timing_type === 'relative') {
      console.log(`Message will be sent: ${formData.relative_quantity} ${formData.relative_unit} ${formData.relative_proximity} trigger`);
    }
    
    // Log recipient information
    console.log('=== RECIPIENT ANALYSIS ===');
    console.log('Recipient type:', formData.recipient_type);
    if (formData.recipient_type === 'specific_phone') {
      console.log('Specific phone:', formData.specific_phone);
    }
    
    // Log message content analysis
    console.log('=== MESSAGE CONTENT ANALYSIS ===');
    console.log('Message length:', formData.content.length, 'characters');
    console.log('Contains placeholders:', {
      first_name: formData.content.includes('{{first_name}}'),
      last_name: formData.content.includes('{{last_name}}'),
      member_name: formData.content.includes('{{member_name}}'),
      phone: formData.content.includes('{{phone}}'),
      email: formData.content.includes('{{email}}'),
      reservation_time: formData.content.includes('{{reservation_time}}'),
    });

    setIsSaving(true);
    try {
      const url = isCreateMode 
        ? '/api/campaign-messages' 
        : `/api/campaign-messages/${templateId}`;
      
      const method = isCreateMode ? 'POST' : 'PUT';
      
      // Clean up the data to only send relevant fields based on timing type
      let cleanedData: any = { ...formData };
      
      // Remove trigger_type as it's not in the database schema
      delete cleanedData.trigger_type;
      
      // Send all relevant fields including the new timing fields
      const basicFields = [
        'campaign_id', 'name', 'description', 'content', 'recipient_type',
        'specific_phone', 'timing_type', 'specific_time', 'specific_date',
        'recurring_type', 'recurring_time', 'recurring_weekdays', 'recurring_monthly_type',
        'recurring_monthly_day', 'recurring_monthly_value', 'recurring_yearly_date',
        'relative_time', 'relative_quantity', 'relative_unit', 'relative_proximity',
        'include_ledger_pdf', 'is_active', 'selected_private_event_id'
      ];
      
      // Remove all fields except the basic ones
      Object.keys(cleanedData).forEach(key => {
        if (!basicFields.includes(key)) {
          delete cleanedData[key];
        }
      });
      
      // If creating a template within a campaign, set the campaign_id
      const dataToSend = isCreateMode && campaignId 
        ? { ...cleanedData, campaign_id: campaignId }
        : cleanedData;
      
      console.log('Sending request to:', url);
      console.log('Request method:', method);
      console.log('Request data:', dataToSend);
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', errorText);
        throw new Error(`Failed to save template: ${response.status} ${response.statusText}`);
      }

      const responseData = await response.json();
      console.log('Response data:', responseData);

      console.log('=== MESSAGE TEMPLATE SAVED SUCCESSFULLY ===');
      console.log('Template will be processed by cron job every 10 minutes');
      console.log('Next processing time:', new Date(Date.now() + 10 * 60 * 1000).toLocaleString());
      
      // If this is an all_members campaign and campaign data has been modified, save the campaign
      if (campaignTriggerType === 'all_members' && campaignId && campaignData) {
        try {
          const campaignResponse = await fetch(`/api/campaigns/${campaignId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              include_event_list: campaignData.include_event_list,
              event_list_date_range: campaignData.event_list_date_range,
            }),
          });

          if (!campaignResponse.ok) {
            console.error('Failed to update campaign event list settings');
          } else {
            console.log('Campaign event list settings updated successfully');
          }
        } catch (error) {
          console.error('Error updating campaign event list settings:', error);
        }
      }
      
      toast({
        title: 'Success',
        description: `Message ${isCreateMode ? 'created' : 'updated'} successfully`,
        status: 'success',
        duration: 3000,
      });

      onTemplateUpdated();
      onClose();
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: 'Error',
        description: 'Failed to save template',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!templateId) return;

    setIsConfirmingDelete(false);
    setIsSaving(true);
    try {
      const response = await fetch(`/api/campaign-messages/${templateId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete template');
      }

      toast({
        title: 'Success',
        description: 'Template deleted successfully',
        status: 'success',
        duration: 3000,
      });

      onTemplateUpdated();
      onClose();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete template',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getPreviewMessage = () => {
    let previewContent = formData.content
      .replace(/\{\{first_name\}\}/g, 'John')
      .replace(/\{\{last_name\}\}/g, 'Doe')
      .replace(/\{\{member_name\}\}/g, 'John Doe')
      .replace(/\{\{phone\}\}/g, '(555) 123-4567')
      .replace(/\{\{email\}\}/g, 'john.doe@example.com');
    
    // Add reservation-specific placeholders if this is a reservation campaign
    if (campaignTriggerType === 'reservation' || campaignTriggerType === 'reservation_time' || campaignTriggerType === 'reservation_created') {
      previewContent = previewContent
        .replace(/\{\{reservation_time\}\}/g, '7:30 PM')
        .replace(/\{\{party_size\}\}/g, '4');
    }
    
    // Add event list if this is an all_members campaign with event list enabled
    if (campaignTriggerType === 'all_members' && campaignData?.include_event_list && noirMemberEvents.length > 0) {
      const eventList = noirMemberEvents.map(event => 
        `• ${event.date} at ${event.time} - ${event.title}`
      ).join('\n');
      
      previewContent += '\n\n📅 Upcoming Noir Member Events:\n' + eventList;
    }
    
    return previewContent;
  };

  const formatTimingDisplay = () => {
    if (formData.timing_type === 'specific_time') {
      return `Send at ${formData.specific_time} on ${formData.specific_date || 'trigger date'}`;
    } else if (formData.timing_type === 'recurring') {
      let display = `Send ${formData.recurring_type} at ${formData.recurring_time || '10:00'}`;
      if (formData.recurring_type === 'weekly') {
        const days = formData.recurring_weekdays?.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ') || 'selected days';
        display += ` on ${days}`;
      } else if (formData.recurring_type === 'monthly') {
        display += ` on ${formData.recurring_monthly_type} ${formData.recurring_monthly_day} ${formData.recurring_monthly_value}`;
      } else if (formData.recurring_type === 'yearly') {
        display += ` on ${formData.recurring_yearly_date}`;
      }
      return display;
    } else if (formData.timing_type === 'relative') {
      if (formData.relative_quantity === 0) {
        return `Send at ${formData.relative_time} ON trigger date`;
      } else {
        const unit = formData.relative_quantity === 1 ? formData.relative_unit : formData.relative_unit + 's';
        if (formData.relative_unit === 'minute') {
          return `Send ${formData.relative_quantity} ${unit} ${formData.relative_proximity} trigger`;
        } else {
          return `Send at ${formData.relative_time} ${formData.relative_quantity} ${unit} ${formData.relative_proximity} trigger`;
        }
      }
    } else {
      return 'Timing not configured';
    }
  };

  const formatPhoneNumber = (phone: string) => {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    
    return phone;
  };

  const handlePhoneChange = (phone: string) => {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    
    // Convert to international format for storage
    let formattedPhone = phone;
    if (digits.length === 10) {
      formattedPhone = '+1' + digits;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      formattedPhone = '+' + digits;
    } else {
      formattedPhone = '+' + digits;
    }
    
    setFormData(prev => ({ ...prev, specific_phone: formattedPhone }));
  };

  const getRecipientOptions = () => {
    if (!campaignTriggerType) return [];
    
    switch (campaignTriggerType) {
      case 'member_signup':
      case 'member_birthday':
      case 'member_renewal':
        return [
          { value: 'member', label: 'Member' },
          { value: 'specific_phone', label: 'Custom phone number' }
        ];
      
      case 'reservation':
      case 'reservation_time':
      case 'reservation_created':
        return [
          { value: 'member', label: 'Phone number on reservation' },
          { value: 'specific_phone', label: 'Custom phone number' }
        ];
      
      case 'recurring':
        return [
          { value: 'member', label: 'Member' },
          { value: 'all_members', label: 'All Members' },
          { value: 'specific_phone', label: 'Custom phone number' }
        ];
      
      case 'reservation_range':
        return [
          { value: 'reservation_phones', label: 'Phone numbers on Reservations within time period' },
          { value: 'specific_phone', label: 'Custom phone number' }
        ];
      
      case 'private_event':
        return [
          { value: 'private_event_rsvps', label: 'Phone numbers of RSVPs for Private event' },
          { value: 'specific_phone', label: 'Custom phone number' }
        ];
      
      case 'all_members':
        return [
          { value: 'all_members', label: 'Phone numbers of all existing members' },
          { value: 'all_primary_members', label: 'All primary members' },
          { value: 'specific_phone', label: 'Custom phone number' }
        ];
      
      default:
        // member_signup, member_birthday, member_renewal
        return [
          { value: 'member', label: 'Primary member' },
          { value: 'all_members', label: 'All members' },
          { value: 'specific_phone', label: 'Custom phone number' }
        ];
    }
  };

  const getTimingOptions = () => {
    if (!campaignTriggerType) return ['specific_time', 'recurring', 'relative'];
    
    switch (campaignTriggerType) {
      case 'recurring':
        return ['specific_time', 'recurring', 'relative'];
      
      case 'all_members':
        return ['specific_time', 'recurring', 'relative'];
      
      case 'reservation_range':
      case 'private_event':
        return ['specific_time', 'recurring', 'relative'];
      
      default:
        // member_signup, member_birthday, member_renewal, reservation_time, reservation_created
        return ['specific_time', 'recurring', 'relative'];
    }
  };

  const shouldShowRelativeOption = () => {
    if (!campaignTriggerType) return false;
    
    // Only show relative option for triggers that have specific dates/times
    return ['member_signup', 'member_birthday', 'reservation_time', 'reservation_created', 'private_event'].includes(campaignTriggerType);
  };

  const getAvailablePlaceholders = () => {
    const placeholders = [
      { name: '{{first_name}}', description: 'Member first name' },
      { name: '{{last_name}}', description: 'Member last name' },
      { name: '{{member_name}}', description: 'Full member name' },
      { name: '{{phone}}', description: 'Member phone number' },
      { name: '{{email}}', description: 'Member email address' },
      { name: '{{reservation_time}}', description: 'Reservation date and time' },
      { name: '{{reservation_date}}', description: 'Reservation date only' },
      { name: '{{event_name}}', description: 'Private event name' },
      { name: '{{event_date}}', description: 'Private event date' },
      { name: '{{event_time}}', description: 'Private event time' },
    ];
    
    return placeholders;
  };

  const shouldShowLedgerPdfOption = () => {
    if (!campaignTriggerType) return false;
    
    // Only show ledger PDF for member-related triggers
    return ['member_signup', 'member_birthday', 'member_renewal'].includes(campaignTriggerType);
  };

  return (
    <Drawer 
      isOpen={isOpen} 
      placement="right" 
      onClose={onClose} 
      size="sm"
      closeOnOverlayClick={true}
      closeOnEsc={true}
    >
      <Box zIndex="2000" position="relative">
        <DrawerOverlay bg="blackAlpha.600" onClick={onClose} />
        <DrawerContent 
          border="2px solid #353535" 
          borderRadius="10px"  
          fontFamily="Montserrat, sans-serif" 
          maxW="500px" 
          w="50vw" 
          boxShadow="xl" 
          mt="80px" 
          mb="25px" 
          paddingRight="40px" 
          paddingLeft="40px" 
          backgroundColor="#ecede8"
          position="fixed"
          top="0"
          right="0"
          style={{
            transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            willChange: 'transform',
            transformStyle: 'preserve-3d',
            backfaceVisibility: 'hidden'
          }}
        >
          <DrawerHeader borderBottomWidth="1px" margin="0" fontWeight="bold" paddingTop="0px" fontSize="24px" fontFamily="IvyJournal, sans-serif" color="#353535">
            <HStack justify="space-between" align="center">
              <Text>
                {isCreateMode ? 'Create/Edit Message' : 'Edit Message'}
              </Text>
              <IconButton
                aria-label="Close drawer"
                icon={<CloseIcon />}
                size="sm"
                variant="ghost"
                bg="#353535"
                onClick={onClose}
                color="#ECEDE8"
                _hover={{ bg: '#2a2a2a' }}
              />
            </HStack>
          </DrawerHeader>

          <DrawerBody className="drawer-body-content" overflowY="auto" maxH="calc(100vh - 200px)">
            {isLoading ? (
              <Box display="flex" justifyContent="center" alignItems="center" height="200px">
                <Spinner size="xl" color="#a59480" />
              </Box>
            ) : (
              <VStack spacing={6} align="stretch">
                {/* Basic Information */}
                <Box>
                  <Text fontSize="lg" fontWeight="bold" mb={4} fontFamily="'Montserrat', sans-serif" color="#a59480">
                    Basic Information
                  </Text>
                  <VStack spacing={4}>
                    <FormControl>
                      <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Template Name</FormLabel>
                      <Input
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        bg="#ecede8"
                        color="#353535"
                        borderColor="#a59480"
                        _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                      />
                    </FormControl>

                    <FormControl>
                      <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Description</FormLabel>
                      <Input
                        value={formData.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        bg="#ecede8"
                        color="#353535"
                        borderColor="#a59480"
                        _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                      />
                    </FormControl>
                  </VStack>
                </Box>

                <Divider borderColor="#a59480" />

                {/* Recipient Configuration */}
                <Box>
                  <VStack spacing={4}>
                    <FormControl>
                      <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Recipient Type</FormLabel>
                      <Select
                        value={formData.recipient_type}
                        onChange={(e) => handleInputChange('recipient_type', e.target.value)}
                        bg="#ecede8"
                        color="#353535"
                        borderColor="#a59480"
                        _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                      >
                        {getRecipientOptions().map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </FormControl>

                    {formData.recipient_type === 'specific_phone' && (
                      <FormControl>
                        <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Phone Number</FormLabel>
                        <Input
                          value={formatPhoneNumber(formData.specific_phone || '')}
                          onChange={(e) => handlePhoneChange(e.target.value)}
                          bg="#ecede8"
                          color="#353535"
                          borderColor="#a59480"
                          _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                          placeholder="(555) 123-4567"
                        />
                        <Text fontSize="xs" color="#a59480" mt={1}>
                          Format: (XXX) XXX-XXXX
                        </Text>
                      </FormControl>
                    )}

                    {formData.recipient_type === 'private_event_rsvps' && (
                      <FormControl>
                        <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Select Private Event</FormLabel>
                        {isLoadingPrivateEvents ? (
                          <Box display="flex" justifyContent="center" alignItems="center" height="100px">
                            <Spinner size="md" color="#a59480" />
                          </Box>
                        ) : (
                          <Select
                            value={formData.selected_private_event_id || ''}
                            onChange={(e) => handleInputChange('selected_private_event_id', e.target.value)}
                            bg="#ecede8"
                            color="#353535"
                            borderColor="#a59480"
                            _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                            placeholder="Select a private event"
                          >
                            <option value="">Select a private event</option>
                            {privateEvents.map((event) => (
                              <option key={event.id} value={event.id}>
                                {new Date(event.start_time).toLocaleDateString()} {new Date(event.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {event.title}
                              </option>
                            ))}
                          </Select>
                        )}
                        {privateEvents.length === 0 && !isLoadingPrivateEvents && (
                          <Text fontSize="xs" color="#a59480" mt={1}>
                            No private events found. Create some private events first.
                          </Text>
                        )}
                      </FormControl>
                    )}
                  </VStack>
                </Box>

                <Divider borderColor="#a59480" />

                {/* Event List Configuration - Only for all_members campaigns */}
                {campaignTriggerType === 'all_members' && (
                  <Box>
                    <Text fontSize="lg" fontWeight="bold" mb={4} fontFamily="'Montserrat', sans-serif" color="#a59480">
                      Event List Configuration
                    </Text>
                    <VStack spacing={4}>
                      <FormControl display="flex" alignItems="center">
                        <FormLabel htmlFor="include-event-list" mb="0" fontFamily="'Montserrat', sans-serif" color="#a59480">
                          Include Event List
                        </FormLabel>
                        <Switch
                          id="include-event-list"
                          isChecked={campaignData?.include_event_list || false}
                          onChange={(e) => {
                            // Update campaign data locally for preview
                            setCampaignData(prev => ({
                              ...prev,
                              include_event_list: e.target.checked,
                              event_list_date_range: e.target.checked ? (prev?.event_list_date_range || { type: 'this_month' }) : null
                            }));
                            // If enabling, fetch events immediately
                            if (e.target.checked) {
                              fetchNoirMemberEvents(campaignData?.event_list_date_range || { type: 'this_month' });
                            } else {
                              setNoirMemberEvents([]);
                            }
                          }}
                          colorScheme="green"
                        />
                      </FormControl>
                      
                      {campaignData?.include_event_list && (
                        <VStack spacing={4} align="stretch">
                          <FormControl>
                            <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Event Date Range</FormLabel>
                            <Select
                              value={campaignData?.event_list_date_range?.type || 'this_month'}
                              onChange={(e) => {
                                const newDateRange = { 
                                  ...campaignData?.event_list_date_range, 
                                  type: e.target.value 
                                };
                                setCampaignData(prev => ({
                                  ...prev,
                                  event_list_date_range: newDateRange
                                }));
                                fetchNoirMemberEvents(newDateRange);
                              }}
                              bg="#ecede8"
                              color="#353535"
                              borderColor="#a59480"
                              _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                            >
                              <option value="this_month">This Month</option>
                              <option value="next_month">Next Month</option>
                              <option value="specific_range">Specific Date Range</option>
                            </Select>
                          </FormControl>

                          {campaignData?.event_list_date_range?.type === 'specific_range' && (
                            <HStack spacing={4}>
                              <FormControl>
                                <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Start Date</FormLabel>
                                <Input
                                  type="date"
                                  value={campaignData?.event_list_date_range?.start_date || ''}
                                  onChange={(e) => {
                                    const newDateRange = { 
                                      ...campaignData?.event_list_date_range, 
                                      start_date: e.target.value 
                                    };
                                    setCampaignData(prev => ({
                                      ...prev,
                                      event_list_date_range: newDateRange
                                    }));
                                    if (newDateRange.start_date && newDateRange.end_date) {
                                      fetchNoirMemberEvents(newDateRange);
                                    }
                                  }}
                                  bg="#ecede8"
                                  color="#353535"
                                  borderColor="#a59480"
                                  _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                                />
                              </FormControl>
                              <FormControl>
                                <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">End Date</FormLabel>
                                <Input
                                  type="date"
                                  value={campaignData?.event_list_date_range?.end_date || ''}
                                  onChange={(e) => {
                                    const newDateRange = { 
                                      ...campaignData?.event_list_date_range, 
                                      end_date: e.target.value 
                                    };
                                    setCampaignData(prev => ({
                                      ...prev,
                                      event_list_date_range: newDateRange
                                    }));
                                    if (newDateRange.start_date && newDateRange.end_date) {
                                      fetchNoirMemberEvents(newDateRange);
                                    }
                                  }}
                                  bg="#ecede8"
                                  color="#353535"
                                  borderColor="#a59480"
                                  _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                                />
                              </FormControl>
                            </HStack>
                          )}

                          <Text fontSize="sm" color="#a59480">
                            Will include all "Noir Member Event" events within the selected date range.
                          </Text>
                        </VStack>
                      )}
                    </VStack>
                  </Box>
                )}

                <Divider borderColor="#a59480" />

                {/* Timing Configuration */}
                <Box>
                  <VStack spacing={4}>
                    <FormControl>
                      <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Timing Type</FormLabel>
                      <RadioGroup value={formData.timing_type} onChange={(value) => handleInputChange('timing_type', value)}>
                        <Stack direction="column">
                          <Radio 
                            value="specific_time" 
                            colorScheme="green"
                            bg={formData.timing_type === 'specific_time' ? '#ecede8' : 'transparent'}
                            p={2}
                            borderRadius="md"
                            border={formData.timing_type === 'specific_time' ? '2px solid #a59480' : '1px solid transparent'}
                          >
                            Send at specific time
                          </Radio>
                          <Radio 
                            value="recurring" 
                            colorScheme="green"
                            bg={formData.timing_type === 'recurring' ? '#ecede8' : 'transparent'}
                            p={2}
                            borderRadius="md"
                            border={formData.timing_type === 'recurring' ? '2px solid #a59480' : '1px solid transparent'}
                          >
                            Send on recurring schedule
                          </Radio>
                          {shouldShowRelativeOption() && (
                            <Radio 
                              value="relative" 
                              colorScheme="green"
                              bg={formData.timing_type === 'relative' ? '#ecede8' : 'transparent'}
                              p={2}
                              borderRadius="md"
                              border={formData.timing_type === 'relative' ? '2px solid #a59480' : '1px solid transparent'}
                            >
                              Send relative to trigger date
                            </Radio>
                          )}
                        </Stack>
                      </RadioGroup>
                    </FormControl>

                    {formData.timing_type === 'specific_time' && (
                      <VStack spacing={4} width="100%">
                        <HStack spacing={4} width="100%">
                          <FormControl>
                            <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Time</FormLabel>
                            <Input
                              type="time"
                              value={formData.specific_time}
                              onChange={(e) => handleInputChange('specific_time', e.target.value)}
                              bg="#ecede8"
                              color="#353535"
                              borderColor="#a59480"
                              _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                            />
                          </FormControl>

                          <FormControl>
                            <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Date</FormLabel>
                            <Input
                              type="date"
                              value={formData.specific_date}
                              onChange={(e) => handleInputChange('specific_date', e.target.value)}
                              bg="#ecede8"
                              color="#353535"
                              borderColor="#a59480"
                              _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                            />
                          </FormControl>
                        </HStack>
                      </VStack>
                    )}

                    {formData.timing_type === 'recurring' && (
                      <VStack spacing={4} width="100%">
                        <FormControl>
                          <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Recurring Type</FormLabel>
                          <RadioGroup value={formData.recurring_type} onChange={(value) => handleInputChange('recurring_type', value)}>
                            <Stack direction="column">
                              <Radio value="daily" colorScheme="green">Daily</Radio>
                              <Radio value="weekly" colorScheme="green">Weekly</Radio>
                              <Radio value="monthly" colorScheme="green">Monthly</Radio>
                              <Radio value="yearly" colorScheme="green">Yearly</Radio>
                            </Stack>
                          </RadioGroup>
                        </FormControl>

                        <FormControl>
                          <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Time</FormLabel>
                          <Input
                            type="time"
                            value={formData.recurring_time || '10:00'}
                            onChange={(e) => handleInputChange('recurring_time', e.target.value)}
                            bg="#ecede8"
                            color="#353535"
                            borderColor="#a59480"
                            _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                          />
                        </FormControl>

                        {formData.recurring_type === 'weekly' && (
                          <FormControl>
                            <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Select Weekdays</FormLabel>
                            <CheckboxGroup value={formData.recurring_weekdays || []} onChange={(value) => handleInputChange('recurring_weekdays', value)}>
                              <Stack direction="column">
                                <Checkbox value="0">Sunday</Checkbox>
                                <Checkbox value="1">Monday</Checkbox>
                                <Checkbox value="2">Tuesday</Checkbox>
                                <Checkbox value="3">Wednesday</Checkbox>
                                <Checkbox value="4">Thursday</Checkbox>
                                <Checkbox value="5">Friday</Checkbox>
                                <Checkbox value="6">Saturday</Checkbox>
                              </Stack>
                            </CheckboxGroup>
                          </FormControl>
                        )}

                        {formData.recurring_type === 'monthly' && (
                          <>
                            <FormControl>
                              <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Monthly Type</FormLabel>
                              <RadioGroup value={formData.recurring_monthly_type} onChange={(value) => handleInputChange('recurring_monthly_type', value)}>
                                <Stack direction="column">
                                  <Radio value="first" colorScheme="green">First</Radio>
                                  <Radio value="second" colorScheme="green">Second</Radio>
                                  <Radio value="third" colorScheme="green">Third</Radio>
                                  <Radio value="fourth" colorScheme="green">Fourth</Radio>
                                  <Radio value="last" colorScheme="green">Last</Radio>
                                </Stack>
                              </RadioGroup>
                            </FormControl>

                            <FormControl>
                              <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Day/Weekday</FormLabel>
                              <RadioGroup value={formData.recurring_monthly_day} onChange={(value) => handleInputChange('recurring_monthly_day', value)}>
                                <Stack direction="column">
                                  <Radio value="day" colorScheme="green">Day</Radio>
                                  <Radio value="weekday" colorScheme="green">Weekday</Radio>
                                </Stack>
                              </RadioGroup>
                            </FormControl>

                            <FormControl>
                              <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Value</FormLabel>
                              <NumberInput
                                value={formData.recurring_monthly_value || 1}
                                onChange={(value) => handleInputChange('recurring_monthly_value', parseInt(value))}
                                min={0}
                                max={31}
                                bg="#ecede8"
                                color="#353535"
                                borderColor="#a59480"
                                _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                              >
                                <NumberInputField 
                                  placeholder="1-31"
                                  _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                                />
                                <NumberInputStepper>
                                  <NumberIncrementStepper />
                                  <NumberDecrementStepper />
                                </NumberInputStepper>
                              </NumberInput>
                            </FormControl>
                          </>
                        )}

                        {formData.recurring_type === 'yearly' && (
                          <FormControl>
                            <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Yearly Date</FormLabel>
                            <Input
                              type="date"
                              value={formData.recurring_yearly_date || ''}
                              onChange={(e) => handleInputChange('recurring_yearly_date', e.target.value)}
                              bg="#ecede8"
                              color="#353535"
                              borderColor="#a59480"
                              _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                            />
                          </FormControl>
                        )}
                      </VStack>
                    )}

                    {formData.timing_type === 'relative' && (
                      <VStack spacing={4} width="100%">
                        <HStack spacing={4} width="100%">
                          {formData.relative_unit !== 'minute' && (
                            <FormControl>
                              <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Time</FormLabel>
                              <Input
                                type="time"
                                value={formData.relative_time || '10:00'}
                                onChange={(e) => handleInputChange('relative_time', e.target.value)}
                                bg="#ecede8"
                                color="#353535"
                                borderColor="#a59480"
                                _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                              />
                            </FormControl>
                          )}

                          <FormControl>
                            <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Quantity</FormLabel>
                            <NumberInput
                              value={formData.relative_quantity ?? 1}
                              onChange={(value) => handleInputChange('relative_quantity', parseInt(value))}
                              min={0}
                              max={formData.relative_unit === 'minute' ? 1440 : 365}
                              bg="#ecede8"
                              color="#353535"
                              borderColor="#a59480"
                              _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                            >
                              <NumberInputField 
                                placeholder={formData.relative_unit === 'minute' ? "1-1440" : "1-365"}
                                _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                              />
                              <NumberInputStepper>
                                <NumberIncrementStepper />
                                <NumberDecrementStepper />
                              </NumberInputStepper>
                            </NumberInput>
                          </FormControl>

                          <FormControl>
                            <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Time Unit</FormLabel>
                            <Select
                              value={formData.relative_unit || 'day'}
                              onChange={(e) => handleInputChange('relative_unit', e.target.value)}
                              bg="#ecede8"
                              color="#353535"
                              borderColor="#a59480"
                              _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                            >
                              <option value="minute">Minutes</option>
                              <option value="hour">Hours</option>
                              <option value="day">Days</option>
                              <option value="week">Weeks</option>
                              <option value="month">Months</option>
                              <option value="year">Years</option>
                            </Select>
                          </FormControl>

                          <FormControl>
                            <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">Proximity</FormLabel>
                            <Select
                              value={formData.relative_proximity || 'after'}
                              onChange={(e) => handleInputChange('relative_proximity', e.target.value)}
                              bg="#ecede8"
                              color="#353535"
                              borderColor="#a59480"
                              _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                            >
                              <option value="before">Before</option>
                              <option value="after">After</option>
                            </Select>
                          </FormControl>
                        </HStack>
                      </VStack>
                    )}

                    <Box p={4} bg="#ecede8" borderRadius="md" border="1px solid #a59480">
                      <Text fontFamily="'Montserrat', sans-serif" color="#353535" fontWeight="bold">
                        {formatTimingDisplay()}
                      </Text>
                    </Box>
                  </VStack>
                </Box>

                <Divider borderColor="#a59480" />

                {/* Message Template */}
                <Box>
                  <VStack spacing={4}>
                    <FormControl>
                      <FormLabel fontFamily="'Montserrat', sans-serif" color="#a59480">
                        Message Content
                        <IconButton
                          aria-label="View available placeholders"
                          icon={<InfoIcon />}
                          size="sm"
                          variant="ghost"
                          color="#a59480"
                          ml={2}
                          onClick={() => {
                            const placeholders = getAvailablePlaceholders();
                            const placeholderText = placeholders.map(p => `${p.name}: ${p.description}`).join('\n');
                            alert(`Available Placeholders:\n\n${placeholderText}`);
                          }}
                        />
                      </FormLabel>
                      <Textarea
                        value={formData.content}
                        onChange={(e) => handleInputChange('content', e.target.value)}
                        rows={8}
                        minH="200px"
                        resize="vertical"
                        bg="#ecede8"
                        color="#353535"
                        borderColor="#a59480"
                        _focus={{ borderColor: '#a59480', boxShadow: '0 0 0 1px #a59480' }}
                        placeholder="Enter your message template here. Use placeholders like {{first_name}}, {{last_name}}, etc."
                        fontFamily="'Montserrat', sans-serif"
                        fontSize="14px"
                        lineHeight="1.5"
                        w="90%"
                      />
                    </FormControl>

                    {/* Preview Toggle */}
                    <FormControl display="flex" alignItems="center">
                      <FormLabel htmlFor="show-preview" mb="0" fontFamily="'Montserrat', sans-serif" color="#a59480">
                        Show Preview
                      </FormLabel>
                      <Switch
                        id="show-preview"
                        isChecked={showPreview}
                        onChange={(e) => setShowPreview(e.target.checked)}
                        colorScheme="green"
                      />
                    </FormControl>

                    {/* Preview Section */}
                    {showPreview && formData.content && (
                      <Box>
                        <Text fontSize="sm" fontWeight="bold" mb={2} fontFamily="'Montserrat', sans-serif" color="#a59480">
                          Preview:
                        </Text>
                        <Box 
                          p={4} 
                          bg="#ecede8" 
                          borderRadius="md" 
                          border="1px solid #a59480"
                          minH="120px"
                          maxH="200px"
                          overflowY="auto"
                          w="90%"
                        >
                          <Text 
                            fontFamily="'Montserrat', sans-serif" 
                            color="#353535" 
                            whiteSpace="pre-wrap"
                            fontSize="14px"
                            lineHeight="1.5"
                          >
                            {getPreviewMessage()}
                          </Text>
                        </Box>
                      </Box>
                    )}

                    {/* Event List Preview - Only for all_members campaigns with event list enabled */}
                    {campaignTriggerType === 'all_members' && campaignData?.include_event_list && (
                      <Box>
                        <Text fontSize="sm" fontWeight="bold" mb={2} fontFamily="'Montserrat', sans-serif" color="#a59480">
                          Event List Preview:
                        </Text>
                        <Box 
                          p={4} 
                          bg="#f0f8ff" 
                          borderRadius="md" 
                          border="1px solid #a59480"
                          minH="100px"
                          maxH="200px"
                          overflowY="auto"
                          w="90%"
                        >
                          {noirMemberEvents.length > 0 ? (
                            <VStack spacing={2} align="stretch">
                              {noirMemberEvents.map((event, index) => (
                                <Box key={index} p={2} bg="white" borderRadius="sm" border="1px solid #e0e0e0">
                                  <Text fontWeight="bold" fontSize="sm" color="#353535">
                                    {event.title}
                                  </Text>
                                  <Text fontSize="xs" color="#666">
                                    {event.date} at {event.time}
                                  </Text>
                                  {event.description && (
                                    <Text fontSize="xs" color="#666" mt={1}>
                                      {event.description}
                                    </Text>
                                  )}
                                </Box>
                              ))}
                            </VStack>
                          ) : (
                            <Text fontSize="sm" color="#666" fontStyle="italic">
                              No Noir Member Events found for the selected date range.
                            </Text>
                          )}
                        </Box>
                      </Box>
                    )}
                  </VStack>
                </Box>

                <Divider borderColor="#a59480" />

                {/* Ledger PDF Option - Only for member-related triggers */}
                {shouldShowLedgerPdfOption() && (
                  <>
                    <Button
                      size="sm"
                      colorScheme={formData.include_ledger_pdf ? 'green' : 'gray'}
                      variant="outline"
                      onClick={() => handleInputChange('include_ledger_pdf', !formData.include_ledger_pdf)}
                      fontFamily="'Montserrat', sans-serif"
                      fontWeight="bold"
                      _hover={{
                        transform: 'translateY(-1px)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      }}
                    >
                      {formData.include_ledger_pdf ? '✓ Include Ledger PDF' : 'Include Ledger PDF'}
                    </Button>
                    <Divider borderColor="#a59480" />
                  </>
                )}

                {/* Status */}
                <Box>
                  <Text fontSize="lg" fontWeight="bold" mb={4} fontFamily="'Montserrat', sans-serif" color="#a59480">
                    Status
                  </Text>
                  <HStack spacing={4} align="center">
                    <Button
                      size="sm"
                      colorScheme={formData.is_active ? 'green' : 'red'}
                      variant="outline"
                      onClick={() => handleInputChange('is_active', !formData.is_active)}
                      fontFamily="'Montserrat', sans-serif"
                      fontWeight="bold"
                      _hover={{
                        transform: 'translateY(-1px)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      }}
                    >
                      {formData.is_active ? 'Active' : 'Inactive'}
                    </Button>
                  </HStack>
                </Box>

                {/* Delete Section */}
                {!isCreateMode && templateId && (
                  <>
                    <Divider borderColor="#a59480" />
                    <Box>
                      <Text fontSize="lg" fontWeight="bold" mb={4} fontFamily="'Montserrat', sans-serif" color="#ef4444">
                        Danger Zone
                      </Text>
                      <Button
                        colorScheme="red"
                        variant="outline"
                        onClick={() => setIsConfirmingDelete(true)}
                        fontFamily="'Montserrat', sans-serif"
                      >
                        Delete Template
                      </Button>
                    </Box>
                  </>
                )}
              </VStack>
            )}
          </DrawerBody>

          <DrawerFooter className="drawer-footer-content">
            <HStack spacing={4} w="full">
              <Button
                variant="outline"
                onClick={onClose}
                flex={1}
                fontFamily="'Montserrat', sans-serif"
                borderColor="#353535"
                color="#353535"
                _hover={{ bg: '#f0f0f0' }}
              >
                Cancel
              </Button>
              <Button
                colorScheme="blue"
                onClick={handleSave}
                isLoading={isSaving}
                loadingText="Saving..."
                flex={1}
                fontFamily="'Montserrat', sans-serif"
                bg="#a59480"
                color="#ECEDE8"
                _hover={{ bg: '#8a7a6a' }}
              >
                {isCreateMode ? 'Create Template' : 'Update Template'}
              </Button>
            </HStack>
          </DrawerFooter>
        </DrawerContent>
      </Box>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        isOpen={isConfirmingDelete}
        onClose={() => setIsConfirmingDelete(false)}
        leastDestructiveRef={cancelRef}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Template
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to delete this template? This action cannot be undone.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button onClick={() => setIsConfirmingDelete(false)}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleDelete} ml={3}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Drawer>
  );
};

export default CampaignTemplateDrawer; 