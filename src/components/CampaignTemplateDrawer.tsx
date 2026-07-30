import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Info } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '@/hooks/useToast';
import { CampaignTriggerType } from '../types';

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

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

  const toggleWeekday = (day: number) => {
    const current = formData.recurring_weekdays || [];
    const next = current.includes(day) ? current.filter(d => d !== day) : [...current, day];
    handleInputChange('recurring_weekdays', next);
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
            toast({
              title: 'Warning',
              description: 'Message saved but campaign settings update failed. Please try updating campaign settings separately.',
              status: 'warning',
              duration: 5000,
            });
          }
        } catch (error) {
          console.error('Error updating campaign event list settings:', error);
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
    const validLocationCount = campaignData?.campaign_locations?.filter(cl => cl.location != null).length || 0;
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
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        overlayClassName="bg-black/70"
        className="sheet-dvh-max-height flex w-full flex-col overflow-hidden rounded-[10px] border-2 border-[#353535] bg-[#ecede8] p-0 sm:max-w-lg"
        style={{ fontFamily: 'Montserrat, sans-serif' }}
      >
        <SheetHeader className="shrink-0 border-b p-4 pb-2 pt-3 text-left">
          <SheetTitle
            className="text-xl font-bold text-[#353535]"
            style={{ fontFamily: 'IvyJournal, sans-serif' }}
          >
            {isCreateMode ? 'Create/Edit Message' : 'Edit Message'}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto min-h-0 px-4 py-6 md:px-6">
          {isLoading ? (
            <div className="flex h-[200px] items-center justify-center">
              <Spinner size="lg" className="text-[#a59480]" />
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Basic Information */}
              <div>
                <h3 className="mb-4 text-lg font-bold text-[#a59480]">Basic Information</h3>
                <div className="flex flex-col gap-4">
                  <div>
                    <Label className="text-[#a59480]">Template Name</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-[#a59480]">Description</Label>
                    <Input
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              <Separator className="bg-[#a59480]" />

              {/* Recipient Configuration */}
              <div className="flex flex-col gap-4">
                <div>
                  <Label className="text-[#a59480]">Recipient Type</Label>
                  <Select
                    value={formData.recipient_type}
                    onChange={(e) => handleInputChange('recipient_type', e.target.value)}
                    className="mt-1"
                  >
                    {getRecipientOptions().map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>

                {formData.recipient_type === 'specific_phone' && (
                  <div>
                    <Label className="text-[#a59480]">Phone Number</Label>
                    <Input
                      value={formatPhoneNumber(formData.specific_phone || '')}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="(555) 123-4567"
                      className="mt-1"
                    />
                    <p className="mt-1 text-xs text-[#a59480]">Format: (XXX) XXX-XXXX</p>
                  </div>
                )}

                {formData.recipient_type === 'private_event_rsvps' && (
                  <div>
                    <Label className="text-[#a59480]">Select Private Event</Label>
                    {isLoadingPrivateEvents ? (
                      <div className="flex h-[100px] items-center justify-center">
                        <Spinner size="md" className="text-[#a59480]" />
                      </div>
                    ) : (
                      <Select
                        value={formData.selected_private_event_id || ''}
                        onChange={(e) => handleInputChange('selected_private_event_id', e.target.value)}
                        className="mt-1"
                      >
                        <option value="">Select a private event</option>
                        {privateEvents.map((event) => (
                          <option key={event.id} value={event.id}>
                            {new Date(event.start_time).toLocaleDateString()} {new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {event.title}
                          </option>
                        ))}
                      </Select>
                    )}
                    {privateEvents.length === 0 && !isLoadingPrivateEvents && (
                      <p className="mt-1 text-xs text-[#a59480]">
                        No private events found. Create some private events first.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <Separator className="bg-[#a59480]" />

              {/* Event List Configuration - Only for all_members campaigns */}
              {campaignTriggerType === 'all_members' && (
                <>
                  <div>
                    <h3 className="mb-4 text-lg font-bold text-[#a59480]">Event List Configuration</h3>
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="include-event-list" className="text-[#a59480]">Include Event List</Label>
                        <Switch
                          id="include-event-list"
                          checked={campaignData?.include_event_list || false}
                          onCheckedChange={(checked) => {
                            setCampaignData(prev => ({
                              ...prev,
                              include_event_list: checked,
                              event_list_date_range: checked ? (prev?.event_list_date_range || { type: 'this_month' }) : null
                            }));
                            if (checked) {
                              fetchNoirMemberEvents(campaignData?.event_list_date_range || { type: 'this_month' });
                            } else {
                              setNoirMemberEvents([]);
                            }
                          }}
                        />
                      </div>

                      {campaignData?.include_event_list && (
                        <div className="flex flex-col gap-4">
                          <div>
                            <Label className="text-[#a59480]">Event Date Range</Label>
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
                              className="mt-1"
                            >
                              <option value="this_month">This Month</option>
                              <option value="next_month">Next Month</option>
                              <option value="specific_range">Specific Date Range</option>
                            </Select>
                          </div>

                          {campaignData?.event_list_date_range?.type === 'specific_range' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <Label className="text-[#a59480]">Start Date</Label>
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
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label className="text-[#a59480]">End Date</Label>
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
                                  className="mt-1"
                                />
                              </div>
                            </div>
                          )}

                          <p className="text-sm text-[#a59480]">
                            Will include all "Noir Member Event" events within the selected date range.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <Separator className="bg-[#a59480]" />
                </>
              )}

              {/* Timing Configuration */}
              <div className="flex flex-col gap-4">
                <div>
                  <Label className="text-[#a59480]">Timing Type</Label>
                  <div className="mt-2 flex flex-col gap-2">
                    <label className={`flex items-center gap-2 rounded-md border p-2 text-sm text-[#353535] ${formData.timing_type === 'specific_time' ? 'border-2 border-[#a59480] bg-[#ecede8]' : 'border-transparent'}`}>
                      <input
                        type="radio"
                        name="timing_type"
                        className="h-4 w-4 accent-green-600"
                        checked={formData.timing_type === 'specific_time'}
                        onChange={() => handleInputChange('timing_type', 'specific_time')}
                      />
                      Send at specific time
                    </label>
                    <label className={`flex items-center gap-2 rounded-md border p-2 text-sm text-[#353535] ${formData.timing_type === 'recurring' ? 'border-2 border-[#a59480] bg-[#ecede8]' : 'border-transparent'}`}>
                      <input
                        type="radio"
                        name="timing_type"
                        className="h-4 w-4 accent-green-600"
                        checked={formData.timing_type === 'recurring'}
                        onChange={() => handleInputChange('timing_type', 'recurring')}
                      />
                      Send on recurring schedule
                    </label>
                    {shouldShowRelativeOption() && (
                      <label className={`flex items-center gap-2 rounded-md border p-2 text-sm text-[#353535] ${formData.timing_type === 'relative' ? 'border-2 border-[#a59480] bg-[#ecede8]' : 'border-transparent'}`}>
                        <input
                          type="radio"
                          name="timing_type"
                          className="h-4 w-4 accent-green-600"
                          checked={formData.timing_type === 'relative'}
                          onChange={() => handleInputChange('timing_type', 'relative')}
                        />
                        Send relative to trigger date
                      </label>
                    )}
                  </div>
                </div>

                {formData.timing_type === 'specific_time' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-[#a59480]">Time</Label>
                      <Input
                        type="time"
                        value={formData.specific_time}
                        onChange={(e) => handleInputChange('specific_time', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[#a59480]">Date</Label>
                      <Input
                        type="date"
                        value={formData.specific_date}
                        onChange={(e) => handleInputChange('specific_date', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                )}

                {formData.timing_type === 'recurring' && (
                  <div className="flex flex-col gap-4">
                    <div>
                      <Label className="text-[#a59480]">Recurring Type</Label>
                      <div className="mt-2 flex flex-col gap-2">
                        {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(type => (
                          <label key={type} className="flex items-center gap-2 text-sm capitalize text-[#353535]">
                            <input
                              type="radio"
                              name="recurring_type"
                              className="h-4 w-4 accent-green-600"
                              checked={formData.recurring_type === type}
                              onChange={() => handleInputChange('recurring_type', type)}
                            />
                            {type}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label className="text-[#a59480]">Time</Label>
                      <Input
                        type="time"
                        value={formData.recurring_time || '10:00'}
                        onChange={(e) => handleInputChange('recurring_time', e.target.value)}
                        className="mt-1"
                      />
                    </div>

                    {formData.recurring_type === 'weekly' && (
                      <div>
                        <Label className="text-[#a59480]">Select Weekdays</Label>
                        <div className="mt-2 flex flex-col gap-2">
                          {WEEKDAYS.map((day, index) => (
                            <label key={day} className="flex items-center gap-2 text-sm text-[#353535]">
                              <Checkbox
                                checked={(formData.recurring_weekdays || []).includes(index)}
                                onCheckedChange={() => toggleWeekday(index)}
                              />
                              {day}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {formData.recurring_type === 'monthly' && (
                      <>
                        <div>
                          <Label className="text-[#a59480]">Monthly Type</Label>
                          <div className="mt-2 flex flex-col gap-2">
                            {(['first', 'second', 'third', 'fourth', 'last'] as const).map(type => (
                              <label key={type} className="flex items-center gap-2 text-sm capitalize text-[#353535]">
                                <input
                                  type="radio"
                                  name="recurring_monthly_type"
                                  className="h-4 w-4 accent-green-600"
                                  checked={formData.recurring_monthly_type === type}
                                  onChange={() => handleInputChange('recurring_monthly_type', type)}
                                />
                                {type}
                              </label>
                            ))}
                          </div>
                        </div>

                        <div>
                          <Label className="text-[#a59480]">Day/Weekday</Label>
                          <div className="mt-2 flex flex-col gap-2">
                            {(['day', 'weekday'] as const).map(type => (
                              <label key={type} className="flex items-center gap-2 text-sm capitalize text-[#353535]">
                                <input
                                  type="radio"
                                  name="recurring_monthly_day"
                                  className="h-4 w-4 accent-green-600"
                                  checked={formData.recurring_monthly_day === type}
                                  onChange={() => handleInputChange('recurring_monthly_day', type)}
                                />
                                {type}
                              </label>
                            ))}
                          </div>
                        </div>

                        <div>
                          <Label className="text-[#a59480]">Value</Label>
                          <Input
                            type="number"
                            min={0}
                            max={31}
                            placeholder="1-31"
                            value={formData.recurring_monthly_value ?? 1}
                            onChange={(e) => handleInputChange('recurring_monthly_value', parseInt(e.target.value, 10))}
                            className="mt-1"
                          />
                        </div>
                      </>
                    )}

                    {formData.recurring_type === 'yearly' && (
                      <div>
                        <Label className="text-[#a59480]">Yearly Date</Label>
                        <Input
                          type="date"
                          value={formData.recurring_yearly_date || ''}
                          onChange={(e) => handleInputChange('recurring_yearly_date', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    )}
                  </div>
                )}

                {formData.timing_type === 'relative' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {formData.relative_unit !== 'minute' && (
                      <div>
                        <Label className="text-[#a59480]">Time</Label>
                        <Input
                          type="time"
                          value={formData.relative_time || '10:00'}
                          onChange={(e) => handleInputChange('relative_time', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    )}

                    <div>
                      <Label className="text-[#a59480]">Quantity</Label>
                      <Input
                        type="number"
                        min={0}
                        max={formData.relative_unit === 'minute' ? 1440 : 365}
                        placeholder={formData.relative_unit === 'minute' ? '1-1440' : '1-365'}
                        value={formData.relative_quantity ?? 1}
                        onChange={(e) => handleInputChange('relative_quantity', parseInt(e.target.value, 10))}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label className="text-[#a59480]">Time Unit</Label>
                      <Select
                        value={formData.relative_unit || 'day'}
                        onChange={(e) => handleInputChange('relative_unit', e.target.value)}
                        className="mt-1"
                      >
                        <option value="minute">Minutes</option>
                        <option value="hour">Hours</option>
                        <option value="day">Days</option>
                        <option value="week">Weeks</option>
                        <option value="month">Months</option>
                        <option value="year">Years</option>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-[#a59480]">Proximity</Label>
                      <Select
                        value={formData.relative_proximity || 'after'}
                        onChange={(e) => handleInputChange('relative_proximity', e.target.value)}
                        className="mt-1"
                      >
                        <option value="before">Before</option>
                        <option value="after">After</option>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="rounded-md border border-[#a59480] bg-[#ecede8] p-4">
                  <p className="font-bold text-[#353535]">{formatTimingDisplay()}</p>
                </div>
              </div>

              <Separator className="bg-[#a59480]" />

              {/* Message Template */}
              <div className="flex flex-col gap-4">
                <div>
                  <Label className="flex items-center text-[#a59480]">
                    Message Content
                    <button
                      type="button"
                      aria-label="View available placeholders"
                      className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded text-[#a59480] hover:bg-[#ecede8]"
                      onClick={() => {
                        const placeholders = getAvailablePlaceholders();
                        const placeholderText = placeholders.map(p => `${p.name}: ${p.description}`).join('\n');
                        alert(`Available Placeholders:\n\n${placeholderText}`);
                      }}
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  </Label>
                  <Textarea
                    value={formData.content}
                    onChange={(e) => handleInputChange('content', e.target.value)}
                    rows={8}
                    placeholder="Enter your message template here. Use placeholders like {{first_name}}, {{last_name}}, etc."
                    className="mt-1 min-h-[200px] w-full resize-y text-sm leading-relaxed"
                  />
                </div>

                {/* Preview Toggle */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-preview" className="text-[#a59480]">Show Preview</Label>
                  <Switch
                    id="show-preview"
                    checked={showPreview}
                    onCheckedChange={(checked) => setShowPreview(checked)}
                  />
                </div>

                {/* Preview Section */}
                {showPreview && formData.content && (
                  <div>
                    <p className="mb-2 text-sm font-bold text-[#a59480]">Preview:</p>
                    <div className="max-h-[200px] min-h-[120px] w-full overflow-y-auto rounded-md border border-[#a59480] bg-[#ecede8] p-4">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#353535]">
                        {getPreviewMessage()}
                      </p>
                    </div>
                  </div>
                )}

                {/* Event List Preview - Only for all_members campaigns with event list enabled */}
                {campaignTriggerType === 'all_members' && campaignData?.include_event_list && (
                  <div>
                    <p className="mb-2 text-sm font-bold text-[#a59480]">Event List Preview:</p>
                    <div className="max-h-[200px] min-h-[100px] w-full overflow-y-auto rounded-md border border-[#a59480] bg-[#f0f8ff] p-4">
                      {noirMemberEvents.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {noirMemberEvents.map((event, index) => (
                            <div key={index} className="rounded-sm border border-[#e0e0e0] bg-white p-2">
                              <p className="text-sm font-bold text-[#353535]">{event.title}</p>
                              <p className="text-xs text-[#666]">{event.date} at {event.time}</p>
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
              </div>

              <Separator className="bg-[#a59480]" />

              {/* Ledger PDF Option - Only for member-related triggers */}
              {shouldShowLedgerPdfOption() && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleInputChange('include_ledger_pdf', !formData.include_ledger_pdf)}
                    className={formData.include_ledger_pdf
                      ? 'w-fit border-green-600 text-green-700 hover:bg-green-600 hover:text-white'
                      : 'w-fit border-gray-400 text-gray-600 hover:bg-gray-400 hover:text-white'}
                  >
                    {formData.include_ledger_pdf ? '✓ Include Ledger PDF' : 'Include Ledger PDF'}
                  </Button>
                  <Separator className="bg-[#a59480]" />
                </>
              )}

              {/* Status */}
              <div>
                <h3 className="mb-4 text-lg font-bold text-[#a59480]">Status</h3>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleInputChange('is_active', !formData.is_active)}
                  className={formData.is_active
                    ? 'border-green-600 text-green-700 hover:bg-green-600 hover:text-white'
                    : 'border-red-600 text-red-700 hover:bg-red-600 hover:text-white'}
                >
                  {formData.is_active ? 'Active' : 'Inactive'}
                </Button>
              </div>

              {/* Delete Section */}
              {!isCreateMode && templateId && (
                <>
                  <Separator className="bg-[#a59480]" />
                  <div>
                    <h3 className="mb-4 text-lg font-bold text-red-500">Danger Zone</h3>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsConfirmingDelete(true)}
                      className="min-h-[44px] border-red-600 text-red-700 hover:bg-red-600 hover:text-white"
                    >
                      Delete Template
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <SheetFooter className="shrink-0 flex-row gap-3 border-t px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:px-6 sm:justify-end sm:space-x-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="min-h-[44px] flex-1 border-[#353535] text-[#353535] hover:bg-[#f0f0f0]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="min-h-[44px] flex-1 bg-[#a59480] text-[#ECEDE8] hover:bg-[#8a7a6a]"
          >
            {isSaving ? 'Saving...' : (isCreateMode ? 'Create Template' : 'Update Template')}
          </Button>
        </SheetFooter>
      </SheetContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isConfirmingDelete} onOpenChange={setIsConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsConfirmingDelete(false)} className="min-h-[44px]">
              Cancel
            </Button>
            <Button type="button" onClick={handleDelete} className="min-h-[44px] bg-red-600 text-white hover:bg-red-700">
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
};

export default CampaignTemplateDrawer;
