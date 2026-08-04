import React, { useState, useEffect } from 'react';
import { Info } from 'lucide-react';

import { useToast } from '@/hooks/useToast';
import { Spinner } from '@/components/ui/spinner';
import { useSettings } from '../context/SettingsContext';
import { CampaignTriggerType } from '../types';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  CheckboxRow,
  DialogActions,
  Field,
  FieldRow,
  FormSection,
  NumberField,
  RadioCardGroup,
  SelectField,
  TextAreaField,
  TextField,
  ToggleChipGroup,
  WEEKDAY_OPTIONS,
} from './campaigns/campaign-form-controls';

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
  campaignTriggerType?: CampaignTriggerType;
}

const RECURRING_TYPE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const MONTHLY_TYPE_OPTIONS = [
  { value: 'first', label: 'First' },
  { value: 'second', label: 'Second' },
  { value: 'third', label: 'Third' },
  { value: 'fourth', label: 'Fourth' },
  { value: 'last', label: 'Last' },
];

const MONTHLY_DAY_OPTIONS = [
  { value: 'day', label: 'Day' },
  { value: 'weekday', label: 'Weekday' },
];

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
  const [showPlaceholders, setShowPlaceholders] = useState(false);
  const [privateEvents, setPrivateEvents] = useState<any[]>([]);
  const [isLoadingPrivateEvents, setIsLoadingPrivateEvents] = useState(false);
  const [campaignData, setCampaignData] = useState<any>(null);
  const [noirMemberEvents, setNoirMemberEvents] = useState<any[]>([]);
  const { toast } = useToast();
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

  // Fetch private events when the popup opens for private_event campaigns or when recipient type changes
  useEffect(() => {
    if (isOpen && (campaignTriggerType === 'private_event' || formData.recipient_type === 'private_event_rsvps')) {
      fetchPrivateEvents();
    }
  }, [isOpen, campaignTriggerType, formData.recipient_type]);

  // Fetch campaign data and noir member events when the popup opens for all_members campaigns
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
        });
      }
    } catch (error) {
      console.error('Error fetching private events:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch private events',
        status: 'error',
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
    if (!formData.name.trim() || !formData.content.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        status: 'error',
      });
      return;
    }

    // Validate recipient type matches campaign trigger type
    const validRecipients = getRecipientOptions().map(opt => opt.value);
    if (!validRecipients.includes(formData.recipient_type)) {
      toast({
        title: 'Validation Error',
        description: `Recipient type "${formData.recipient_type}" is not valid for ${campaignTriggerType} campaigns. Please select a valid recipient type.`,
        status: 'error',
      });
      return;
    }

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

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', errorText);
        throw new Error(`Failed to save template: ${response.status} ${response.statusText}`);
      }

      await response.json();

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
            // Show warning to user but don't fail the entire save
            toast({
              title: 'Warning',
              description: 'Message saved but campaign settings update failed. Please try updating campaign settings separately.',
              status: 'warning',
              duration: 5000,
            });
          }
        } catch (error) {
          console.error('Error updating campaign event list settings:', error);
          // Show warning to user but don't fail the entire save
          toast({
            title: 'Warning',
            description: 'Message saved but campaign settings update encountered an error. Please try updating campaign settings separately.',
            status: 'warning',
            duration: 5000,
          });
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
      const eventList = noirMemberEvents.map(event => {
        let eventLine = `• ${event.date} at ${event.time} - ${event.title}`;

        // Add RSVP URL if available
        if (event.rsvpEnabled && event.rsvpUrl) {
          const rsvpUrl = `${window.location.origin}/rsvp/${event.rsvpUrl}`;
          eventLine += `\n  RSVP: ${rsvpUrl}`;
        }

        return eventLine;
      }).join('\n\n');

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

    // Add location context hint if campaign is location-specific
    const validLocationCount = campaignData?.campaign_locations?.filter((cl: any) => cl.location != null).length || 0;
    const locationHint = campaignData?.applies_to_all_locations
      ? ''
      : ` (filtered by ${validLocationCount} location(s))`;

    switch (campaignTriggerType) {
      case 'member_signup':
      case 'member_birthday':
      case 'member_renewal':
        return [
          { value: 'member', label: `Member${locationHint}` },
          { value: 'specific_phone', label: 'Custom phone number' }
        ];

      case 'reservation':
      case 'reservation_time':
      case 'reservation_created':
        return [
          { value: 'member', label: `Phone number on reservation${locationHint}` },
          { value: 'specific_phone', label: 'Custom phone number' }
        ];

      case 'recurring':
        return [
          { value: 'member', label: `Member${locationHint}` },
          { value: 'all_members', label: `All Members${locationHint}` },
          { value: 'specific_phone', label: 'Custom phone number' }
        ];

      case 'reservation_range':
        return [
          { value: 'reservation_phones', label: `Phone numbers on Reservations within time period${locationHint}` },
          { value: 'specific_phone', label: 'Custom phone number' }
        ];

      case 'private_event':
        return [
          { value: 'private_event_rsvps', label: `Phone numbers of RSVPs for Private event${locationHint}` },
          { value: 'specific_phone', label: 'Custom phone number' }
        ];

      case 'all_members':
        return [
          { value: 'all_members', label: `Phone numbers of all existing members${locationHint}` },
          { value: 'all_primary_members', label: `All primary members${locationHint}` },
          { value: 'specific_phone', label: 'Custom phone number' }
        ];

      default:
        // member_signup, member_birthday, member_renewal
        return [
          { value: 'member', label: `Primary member${locationHint}` },
          { value: 'all_members', label: `All members${locationHint}` },
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

  const timingTypeOptions = [
    { value: 'specific_time', label: 'Send at specific time' },
    { value: 'recurring', label: 'Send on recurring schedule' },
    ...(shouldShowRelativeOption()
      ? [{ value: 'relative', label: 'Send relative to trigger date' }]
      : []),
  ].filter((option) => getTimingOptions().includes(option.value));

  return (
    <>
      <ResponsiveDialog
        open={isOpen}
        onOpenChange={(open) => !open && onClose()}
        title={isCreateMode ? 'Create/Edit Message' : 'Edit Message'}
        // While the delete confirmation is up, a tap outside should dismiss
        // that dialog rather than the whole form behind it.
        dismissable={!isConfirmingDelete}
        footer={
          <DialogActions
            onCancel={onClose}
            onSave={handleSave}
            isSaving={isSaving}
            saveLabel={isCreateMode ? 'Create Template' : 'Update Template'}
          />
        }
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Basic Information */}
            <FormSection title="Basic Information">
              <Field label="Template Name" htmlFor="template-name" required>
                <TextField
                  id="template-name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                />
              </Field>

              <Field label="Description" htmlFor="template-description">
                <TextField
                  id="template-description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                />
              </Field>
            </FormSection>

            <hr className="border-[#a59480]" />

            {/* Recipient Configuration */}
            <FormSection title="Recipient">
              <Field label="Recipient Type" htmlFor="recipient-type">
                <SelectField
                  id="recipient-type"
                  value={formData.recipient_type}
                  onChange={(e) => handleInputChange('recipient_type', e.target.value)}
                >
                  {getRecipientOptions().map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </SelectField>
              </Field>

              {formData.recipient_type === 'specific_phone' && (
                <Field label="Phone Number" htmlFor="specific-phone" hint="Format: (XXX) XXX-XXXX">
                  <TextField
                    id="specific-phone"
                    type="tel"
                    inputMode="tel"
                    value={formatPhoneNumber(formData.specific_phone || '')}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="(555) 123-4567"
                  />
                </Field>
              )}

              {formData.recipient_type === 'private_event_rsvps' && (
                <Field
                  label="Select Private Event"
                  htmlFor="private-event-select"
                  hint={
                    privateEvents.length === 0 && !isLoadingPrivateEvents
                      ? 'No private events found. Create some private events first.'
                      : undefined
                  }
                >
                  {isLoadingPrivateEvents ? (
                    <div className="flex items-center justify-center py-6">
                      <Spinner />
                    </div>
                  ) : (
                    <SelectField
                      id="private-event-select"
                      value={formData.selected_private_event_id || ''}
                      onChange={(e) => handleInputChange('selected_private_event_id', e.target.value)}
                    >
                      <option value="">Select a private event</option>
                      {privateEvents.map((event) => (
                        <option key={event.id} value={event.id}>
                          {new Date(event.start_time).toLocaleDateString()} {new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {event.title}
                        </option>
                      ))}
                    </SelectField>
                  )}
                </Field>
              )}
            </FormSection>

            <hr className="border-[#a59480]" />

            {/* Event List Configuration - Only for all_members campaigns */}
            {campaignTriggerType === 'all_members' && (
              <>
                <FormSection title="Event List Configuration">
                  <CheckboxRow
                    id="include-event-list"
                    checked={campaignData?.include_event_list || false}
                    onChange={(checked) => {
                      // Update campaign data locally for preview
                      setCampaignData((prev: any) => ({
                        ...prev,
                        include_event_list: checked,
                        event_list_date_range: checked ? (prev?.event_list_date_range || { type: 'this_month' }) : null,
                      }));
                      // If enabling, fetch events immediately
                      if (checked) {
                        fetchNoirMemberEvents(campaignData?.event_list_date_range || { type: 'this_month' });
                      } else {
                        setNoirMemberEvents([]);
                      }
                    }}
                    label="Include Event List"
                  />

                  {campaignData?.include_event_list && (
                    <div className="space-y-4">
                      <Field label="Event Date Range" htmlFor="event-range-type">
                        <SelectField
                          id="event-range-type"
                          value={campaignData?.event_list_date_range?.type || 'this_month'}
                          onChange={(e) => {
                            const newDateRange = {
                              ...campaignData?.event_list_date_range,
                              type: e.target.value,
                            };
                            setCampaignData((prev: any) => ({
                              ...prev,
                              event_list_date_range: newDateRange,
                            }));
                            fetchNoirMemberEvents(newDateRange);
                          }}
                        >
                          <option value="this_month">This Month</option>
                          <option value="next_month">Next Month</option>
                          <option value="specific_range">Specific Date Range</option>
                        </SelectField>
                      </Field>

                      {campaignData?.event_list_date_range?.type === 'specific_range' && (
                        <FieldRow>
                          <Field label="Start Date" htmlFor="event-range-start">
                            <TextField
                              id="event-range-start"
                              type="date"
                              value={campaignData?.event_list_date_range?.start_date || ''}
                              onChange={(e) => {
                                const newDateRange = {
                                  ...campaignData?.event_list_date_range,
                                  start_date: e.target.value,
                                };
                                setCampaignData((prev: any) => ({
                                  ...prev,
                                  event_list_date_range: newDateRange,
                                }));
                                if (newDateRange.start_date && newDateRange.end_date) {
                                  fetchNoirMemberEvents(newDateRange);
                                }
                              }}
                            />
                          </Field>
                          <Field label="End Date" htmlFor="event-range-end">
                            <TextField
                              id="event-range-end"
                              type="date"
                              value={campaignData?.event_list_date_range?.end_date || ''}
                              onChange={(e) => {
                                const newDateRange = {
                                  ...campaignData?.event_list_date_range,
                                  end_date: e.target.value,
                                };
                                setCampaignData((prev: any) => ({
                                  ...prev,
                                  event_list_date_range: newDateRange,
                                }));
                                if (newDateRange.start_date && newDateRange.end_date) {
                                  fetchNoirMemberEvents(newDateRange);
                                }
                              }}
                            />
                          </Field>
                        </FieldRow>
                      )}

                      <p className="text-sm text-[#a59480]">
                        Will include all &ldquo;Noir Member Event&rdquo; events within the selected date range.
                      </p>
                    </div>
                  )}
                </FormSection>

                <hr className="border-[#a59480]" />
              </>
            )}

            {/* Timing Configuration */}
            <FormSection title="Timing">
              <Field label="Timing Type">
                <RadioCardGroup
                  name="timing-type"
                  value={formData.timing_type}
                  onChange={(value) => handleInputChange('timing_type', value)}
                  options={timingTypeOptions}
                />
              </Field>

              {formData.timing_type === 'specific_time' && (
                <FieldRow>
                  <Field label="Time" htmlFor="specific-time">
                    <TextField
                      id="specific-time"
                      type="time"
                      value={formData.specific_time}
                      onChange={(e) => handleInputChange('specific_time', e.target.value)}
                    />
                  </Field>

                  <Field label="Date" htmlFor="specific-date">
                    <TextField
                      id="specific-date"
                      type="date"
                      value={formData.specific_date}
                      onChange={(e) => handleInputChange('specific_date', e.target.value)}
                    />
                  </Field>
                </FieldRow>
              )}

              {formData.timing_type === 'recurring' && (
                <div className="space-y-4">
                  <Field label="Recurring Type">
                    <RadioCardGroup
                      name="recurring-type"
                      value={formData.recurring_type}
                      onChange={(value) => handleInputChange('recurring_type', value)}
                      options={RECURRING_TYPE_OPTIONS}
                    />
                  </Field>

                  <Field label="Time" htmlFor="recurring-time">
                    <TextField
                      id="recurring-time"
                      type="time"
                      value={formData.recurring_time || '10:00'}
                      onChange={(e) => handleInputChange('recurring_time', e.target.value)}
                    />
                  </Field>

                  {formData.recurring_type === 'weekly' && (
                    <Field label="Select Weekdays">
                      <ToggleChipGroup
                        // Stored as INTEGER[] in the database. The previous
                        // checkbox group compared numbers against string values,
                        // so saved weekdays never showed as selected on reopen.
                        value={(formData.recurring_weekdays || []).map(String)}
                        onChange={(value) =>
                          handleInputChange('recurring_weekdays', value.map(Number).sort((a, b) => a - b))
                        }
                        options={WEEKDAY_OPTIONS}
                      />
                    </Field>
                  )}

                  {formData.recurring_type === 'monthly' && (
                    <>
                      <Field label="Monthly Type">
                        <RadioCardGroup
                          name="monthly-type"
                          value={formData.recurring_monthly_type}
                          onChange={(value) => handleInputChange('recurring_monthly_type', value)}
                          options={MONTHLY_TYPE_OPTIONS}
                        />
                      </Field>

                      <Field label="Day/Weekday">
                        <RadioCardGroup
                          name="monthly-day"
                          value={formData.recurring_monthly_day}
                          onChange={(value) => handleInputChange('recurring_monthly_day', value)}
                          options={MONTHLY_DAY_OPTIONS}
                        />
                      </Field>

                      <Field label="Value" htmlFor="monthly-value">
                        <NumberField
                          id="monthly-value"
                          value={formData.recurring_monthly_value ?? 1}
                          onChange={(value) => handleInputChange('recurring_monthly_value', value)}
                          min={0}
                          max={31}
                          placeholder="1-31"
                        />
                      </Field>
                    </>
                  )}

                  {formData.recurring_type === 'yearly' && (
                    <Field label="Yearly Date" htmlFor="yearly-date">
                      <TextField
                        id="yearly-date"
                        type="date"
                        value={formData.recurring_yearly_date || ''}
                        onChange={(e) => handleInputChange('recurring_yearly_date', e.target.value)}
                      />
                    </Field>
                  )}
                </div>
              )}

              {formData.timing_type === 'relative' && (
                <div className="space-y-4">
                  {formData.relative_unit !== 'minute' && (
                    <Field label="Time" htmlFor="relative-time">
                      <TextField
                        id="relative-time"
                        type="time"
                        value={formData.relative_time || '10:00'}
                        onChange={(e) => handleInputChange('relative_time', e.target.value)}
                      />
                    </Field>
                  )}

                  <Field label="Quantity" htmlFor="relative-quantity">
                    <NumberField
                      id="relative-quantity"
                      value={formData.relative_quantity ?? 1}
                      onChange={(value) => handleInputChange('relative_quantity', value)}
                      min={0}
                      max={formData.relative_unit === 'minute' ? 1440 : 365}
                      placeholder={formData.relative_unit === 'minute' ? '1-1440' : '1-365'}
                    />
                  </Field>

                  <FieldRow>
                    <Field label="Time Unit" htmlFor="relative-unit">
                      <SelectField
                        id="relative-unit"
                        value={formData.relative_unit || 'day'}
                        onChange={(e) => handleInputChange('relative_unit', e.target.value)}
                      >
                        <option value="minute">Minutes</option>
                        <option value="hour">Hours</option>
                        <option value="day">Days</option>
                        <option value="week">Weeks</option>
                        <option value="month">Months</option>
                        <option value="year">Years</option>
                      </SelectField>
                    </Field>

                    <Field label="Proximity" htmlFor="relative-proximity">
                      <SelectField
                        id="relative-proximity"
                        value={formData.relative_proximity || 'after'}
                        onChange={(e) => handleInputChange('relative_proximity', e.target.value)}
                      >
                        <option value="before">Before</option>
                        <option value="after">After</option>
                      </SelectField>
                    </Field>
                  </FieldRow>
                </div>
              )}

              <div className="rounded-md border border-[#a59480] bg-white/60 p-3">
                <p className="text-sm font-bold text-[#353535]">{formatTimingDisplay()}</p>
              </div>
            </FormSection>

            <hr className="border-[#a59480]" />

            {/* Message Template */}
            <FormSection title="Message">
              <Field
                label="Message Content"
                required
                labelAction={
                  <button
                    type="button"
                    aria-label="View available placeholders"
                    aria-expanded={showPlaceholders}
                    onClick={() => setShowPlaceholders((v) => !v)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[#a59480] hover:bg-[#a59480]/15"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                }
                htmlFor="message-content"
              >
                <TextAreaField
                  id="message-content"
                  value={formData.content}
                  onChange={(e) => handleInputChange('content', e.target.value)}
                  rows={8}
                  className="min-h-[180px]"
                  placeholder="Enter your message template here. Use placeholders like {{first_name}}, {{last_name}}, etc."
                />
              </Field>

              {/* Placeholder reference. Was a native alert() before, which is
                  unreadable and uncopyable on a phone. */}
              {showPlaceholders && (
                <div className="rounded-md border border-[#a59480] bg-white p-3">
                  <p className="mb-2 text-sm font-bold text-[#353535]">Available placeholders</p>
                  <dl className="space-y-1.5">
                    {getAvailablePlaceholders().map((placeholder) => (
                      <div key={placeholder.name} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                        <dt className="font-mono text-xs text-[#353535]">{placeholder.name}</dt>
                        <dd className="text-xs text-[#6b6b5f]">{placeholder.description}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              <CheckboxRow
                id="show-preview"
                checked={showPreview}
                onChange={setShowPreview}
                label="Show Preview"
              />

              {/* Preview Section */}
              {showPreview && formData.content && (
                <div>
                  <p className="mb-2 text-sm font-bold text-[#a59480]">Preview:</p>
                  <div className="max-h-[200px] min-h-[120px] overflow-y-auto rounded-md border border-[#a59480] bg-white p-3">
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[#353535]">
                      {getPreviewMessage()}
                    </p>
                  </div>
                </div>
              )}

              {/* Event List Preview - Only for all_members campaigns with event list enabled */}
              {campaignTriggerType === 'all_members' && campaignData?.include_event_list && (
                <div>
                  <p className="mb-2 text-sm font-bold text-[#a59480]">Event List Preview:</p>
                  <div className="max-h-[200px] min-h-[100px] overflow-y-auto rounded-md border border-[#a59480] bg-[#f0f8ff] p-3">
                    {noirMemberEvents.length > 0 ? (
                      <div className="space-y-2">
                        {noirMemberEvents.map((event, index) => (
                          <div key={index} className="rounded border border-[#e0e0e0] bg-white p-2">
                            <p className="text-sm font-bold text-[#353535]">{event.title}</p>
                            <p className="text-xs text-[#666]">
                              {event.date} at {event.time}
                            </p>
                            {event.description && (
                              <p className="mt-1 text-xs text-[#666]">{event.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm italic text-[#666]">
                        No Noir Member Events found for the selected date range.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </FormSection>

            <hr className="border-[#a59480]" />

            {/* Ledger PDF Option - Only for member-related triggers */}
            {shouldShowLedgerPdfOption() && (
              <>
                <CheckboxRow
                  id="include-ledger-pdf"
                  checked={formData.include_ledger_pdf}
                  onChange={(checked) => handleInputChange('include_ledger_pdf', checked)}
                  label="Include Ledger PDF"
                />
                <hr className="border-[#a59480]" />
              </>
            )}

            {/* Status */}
            <FormSection title="Status">
              <button
                type="button"
                onClick={() => handleInputChange('is_active', !formData.is_active)}
                className={
                  formData.is_active
                    ? 'min-h-[44px] rounded-md border border-green-600 px-4 text-sm font-bold text-green-700 transition-colors hover:bg-green-50'
                    : 'min-h-[44px] rounded-md border border-red-600 px-4 text-sm font-bold text-red-700 transition-colors hover:bg-red-50'
                }
              >
                {formData.is_active ? 'Active' : 'Inactive'}
              </button>
            </FormSection>

            {/* Delete Section */}
            {!isCreateMode && templateId && (
              <>
                <hr className="border-[#a59480]" />
                <FormSection title="Danger Zone" className="[&>h3]:text-[#ef4444]">
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(true)}
                    className="min-h-[44px] w-full rounded-md bg-[#ef4444] px-4 text-sm font-medium text-white transition-colors hover:bg-[#dc2626] sm:w-auto"
                  >
                    Delete Template
                  </button>
                </FormSection>
              </>
            )}
          </div>
        )}
      </ResponsiveDialog>

      {/* Delete confirmation. A sibling of the builder popup rather than a
          child, so the popup's overflow cannot clip it, and stacked above the
          builder's z-[1000]/z-[1001] layers so it is actually visible. */}
      <AlertDialog open={isConfirmingDelete} onOpenChange={setIsConfirmingDelete}>
        <AlertDialogContent
          // Raised above the builder's z-[1000]/z-[1001] layers. These two
          // props exist because `className` alone lands on the innermost
          // Content, inside a `position: fixed` wrapper that opens its own
          // stacking context — so the confirmation rendered behind the still
          // opaque builder panel and "Delete Template" looked like it did
          // nothing.
          overlayClassName="z-[1100]"
          containerClassName="z-[1101]"
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-[44px]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="min-h-[44px] bg-[#ef4444] text-white hover:bg-[#dc2626]"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CampaignTemplateDrawer;
