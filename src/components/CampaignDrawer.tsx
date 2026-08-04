import React, { useState, useEffect } from 'react';

import { useToast } from '@/hooks/useToast';
import { Spinner } from '@/components/ui/spinner';
import CampaignBuilderDialog from './campaigns/CampaignBuilderDialog';
import {
  CheckboxRow,
  DialogActions,
  Field,
  FieldRow,
  FormSection,
  RadioCardGroup,
  SelectField,
  TextAreaField,
  TextField,
  ToggleChipGroup,
} from './campaigns/campaign-form-controls';

interface Campaign {
  id?: string;
  name: string;
  description: string;
  trigger_type: 'member_signup' | 'member_birthday' | 'member_renewal' | 'reservation_time' | 'reservation_created' | 'reservation' | 'recurring' | 'reservation_range' | 'private_event' | 'all_members';
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  // New fields for recurring campaigns
  recurring_schedule?: any;
  recurring_start_date?: string;
  recurring_end_date?: string;
  // New fields for reservation range campaigns
  reservation_range_start?: string;
  reservation_range_end?: string;
  // New fields for private event campaigns
  selected_private_event_id?: string;
  // New fields for event list feature
  include_event_list?: boolean;
  event_list_date_range?: any;
}

interface CampaignDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  campaignId?: string | null;
  isCreateMode?: boolean;
  onCampaignUpdated: () => void;
}

const WEEKDAY_OPTIONS = [
  { value: '0', label: 'Sun' },
  { value: '1', label: 'Mon' },
  { value: '2', label: 'Tue' },
  { value: '3', label: 'Wed' },
  { value: '4', label: 'Thu' },
  { value: '5', label: 'Fri' },
  { value: '6', label: 'Sat' },
];

const RECURRING_SCHEDULE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'weekdays', label: 'Specific Weekdays' },
  { value: 'first_of_month', label: '1st of Month' },
  { value: 'last_of_month', label: 'Last Day of Month' },
];

const CampaignDrawer: React.FC<CampaignDrawerProps> = ({
  isOpen,
  onClose,
  campaignId,
  isCreateMode = false,
  onCampaignUpdated,
}) => {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [formData, setFormData] = useState<Campaign>({
    name: '',
    description: '',
    trigger_type: 'reservation',
    is_active: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [privateEvents, setPrivateEvents] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [appliesToAllLocations, setAppliesToAllLocations] = useState(false);
  const { toast } = useToast();

  // Initialization effect: runs when the popup opens or mode/campaign changes
  useEffect(() => {
    if (isOpen) {
      if (!isCreateMode && campaignId) {
        fetchCampaign();
      } else if (isCreateMode) {
        setFormData({
          name: '',
          description: '',
          trigger_type: 'member_signup',
          is_active: true,
          include_event_list: false,
          event_list_date_range: { type: 'this_month' },
        });
        setCampaign(null);
      }
    }
  }, [isOpen, campaignId, isCreateMode]);

  // Fetch locations when the popup opens
  useEffect(() => {
    if (isOpen) {
      fetchLocations();
    }
  }, [isOpen]);

  // Fetch private events only when private_event trigger type is selected
  useEffect(() => {
    if (isOpen && formData.trigger_type === 'private_event') {
      fetchPrivateEvents();
    }
  }, [isOpen, formData.trigger_type]);

  const fetchCampaign = async () => {
    if (!campaignId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`);
      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 500 && errorData.error?.includes('relation "campaigns" does not exist')) {
          toast({
            title: 'Setup Required',
            description: 'Please run the database migration first to create the campaigns table.',
            variant: 'warning',
          });
          onClose();
          return;
        }
        throw new Error('Failed to fetch campaign');
      }
      const data = await response.json();
      setCampaign(data);
      setFormData({
        name: data.name || '',
        description: data.description || '',
        trigger_type: data.trigger_type || 'member_signup',
        is_active: data.is_active !== undefined ? data.is_active : true,
        recurring_schedule: data.recurring_schedule,
        recurring_start_date: data.recurring_start_date,
        recurring_end_date: data.recurring_end_date,
        reservation_range_start: data.reservation_range_start,
        reservation_range_end: data.reservation_range_end,
        selected_private_event_id: data.selected_private_event_id,
        include_event_list: data.include_event_list,
        event_list_date_range: data.event_list_date_range,
      });

      // Set location data
      setAppliesToAllLocations(data.applies_to_all_locations || false);
      if (data.campaign_locations && data.campaign_locations.length > 0) {
        setSelectedLocationIds(data.campaign_locations.map((cl: any) => cl.location_id));
      } else {
        setSelectedLocationIds([]);
      }
    } catch (error) {
      console.error('Error fetching campaign:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch campaign',
        variant: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations');
      if (response.ok) {
        const data = await response.json();
        setLocations(data);
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  const fetchPrivateEvents = async () => {
    try {
      const response = await fetch('/api/private-events');
      if (response.ok) {
        const data = await response.json();
        setPrivateEvents(data);
      }
    } catch (error) {
      console.error('Error fetching private events:', error);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getTriggerTypeOptions = () => [
    { value: 'all_members', label: 'All Members' },
    { value: 'member_birthday', label: 'Member Birthday' },
    { value: 'member_renewal', label: 'Member Renewal' },
    { value: 'member_signup', label: 'Member Signup' },
    { value: 'private_event', label: 'Private Event' },
    { value: 'recurring', label: 'Recurring' },
    { value: 'reservation', label: 'Reservation' },
    { value: 'reservation_created', label: 'Reservation Created' },
    { value: 'reservation_range', label: 'Reservation Range' },
    { value: 'reservation_time', label: 'Reservation Time' },
  ];

  const renderTriggerTypeSpecificFields = () => {
    switch (formData.trigger_type) {
      case 'recurring':
        return (
          <div className="space-y-4">
            <Field label="Recurring Schedule">
              <RadioCardGroup
                name="recurring-schedule"
                value={formData.recurring_schedule?.type || 'weekly'}
                onChange={(value) =>
                  handleInputChange('recurring_schedule', { ...formData.recurring_schedule, type: value })
                }
                options={RECURRING_SCHEDULE_OPTIONS}
              />
            </Field>

            {formData.recurring_schedule?.type === 'weekdays' && (
              <Field label="Select Weekdays">
                <ToggleChipGroup
                  value={formData.recurring_schedule?.weekdays || []}
                  onChange={(value) =>
                    handleInputChange('recurring_schedule', { ...formData.recurring_schedule, weekdays: value })
                  }
                  options={WEEKDAY_OPTIONS}
                />
              </Field>
            )}

            <FieldRow>
              <Field label="Start Date" htmlFor="recurring-start-date">
                <TextField
                  id="recurring-start-date"
                  type="date"
                  value={formData.recurring_start_date || ''}
                  onChange={(e) => handleInputChange('recurring_start_date', e.target.value)}
                />
              </Field>

              <Field label="End Date (Optional)" htmlFor="recurring-end-date">
                <TextField
                  id="recurring-end-date"
                  type="date"
                  value={formData.recurring_end_date || ''}
                  onChange={(e) => handleInputChange('recurring_end_date', e.target.value)}
                />
              </Field>
            </FieldRow>
          </div>
        );

      case 'reservation_range':
        return (
          <FieldRow>
            <Field label="Start Date & Time" htmlFor="range-start">
              <TextField
                id="range-start"
                type="datetime-local"
                value={formData.reservation_range_start || ''}
                onChange={(e) => handleInputChange('reservation_range_start', e.target.value)}
              />
            </Field>

            <Field label="End Date & Time" htmlFor="range-end">
              <TextField
                id="range-end"
                type="datetime-local"
                value={formData.reservation_range_end || ''}
                onChange={(e) => handleInputChange('reservation_range_end', e.target.value)}
              />
            </Field>
          </FieldRow>
        );

      case 'private_event':
        return (
          <Field label="Select Private Event" htmlFor="private-event">
            <SelectField
              id="private-event"
              value={formData.selected_private_event_id || ''}
              onChange={(e) => handleInputChange('selected_private_event_id', e.target.value)}
            >
              <option value="">Select a private event</option>
              {privateEvents.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title} - {new Date(event.start_time).toLocaleDateString()}
                </option>
              ))}
            </SelectField>
          </Field>
        );

      case 'all_members':
        return (
          <div className="space-y-4">
            <CheckboxRow
              id="include-event-list"
              checked={formData.include_event_list || false}
              onChange={(checked) => handleInputChange('include_event_list', checked)}
              label="Include Event List"
            />

            {formData.include_event_list && (
              <div className="space-y-4">
                <Field label="Event Date Range" htmlFor="event-list-range">
                  <SelectField
                    id="event-list-range"
                    value={formData.event_list_date_range?.type || 'this_month'}
                    onChange={(e) =>
                      handleInputChange('event_list_date_range', {
                        ...formData.event_list_date_range,
                        type: e.target.value,
                      })
                    }
                  >
                    <option value="this_month">This Month</option>
                    <option value="next_month">Next Month</option>
                    <option value="specific_range">Specific Date Range</option>
                  </SelectField>
                </Field>

                {formData.event_list_date_range?.type === 'specific_range' && (
                  <FieldRow>
                    <Field label="Start Date" htmlFor="event-list-start">
                      <TextField
                        id="event-list-start"
                        type="date"
                        value={formData.event_list_date_range?.start_date || ''}
                        onChange={(e) =>
                          handleInputChange('event_list_date_range', {
                            ...formData.event_list_date_range,
                            start_date: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="End Date" htmlFor="event-list-end">
                      <TextField
                        id="event-list-end"
                        type="date"
                        value={formData.event_list_date_range?.end_date || ''}
                        onChange={(e) =>
                          handleInputChange('event_list_date_range', {
                            ...formData.event_list_date_range,
                            end_date: e.target.value,
                          })
                        }
                      />
                    </Field>
                  </FieldRow>
                )}

                <p className="text-sm text-[#a59480]">
                  Will include all &ldquo;Noir Member Event&rdquo; events within the selected date range.
                </p>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const handleSave = async () => {
    // Validate required fields
    if (!formData.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'error',
      });
      return;
    }

    // Validate location selection
    if (!appliesToAllLocations && selectedLocationIds.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please select at least one location or enable "Apply to all locations"',
        variant: 'error',
      });
      return;
    }

    setIsSaving(true);
    try {
      const url = isCreateMode
        ? '/api/campaigns'
        : `/api/campaigns/${campaignId}`;

      const method = isCreateMode ? 'POST' : 'PUT';

      const payload = {
        ...formData,
        applies_to_all_locations: appliesToAllLocations,
        location_ids: appliesToAllLocations ? [] : selectedLocationIds,
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to save campaign');
      }

      await response.json();

      toast({
        title: 'Success',
        description: `Campaign ${isCreateMode ? 'created' : 'updated'} successfully`,
        variant: 'success',
      });

      onCampaignUpdated();
      onClose();
    } catch (error) {
      console.error('Error saving campaign:', error);
      toast({
        title: 'Error',
        description: 'Failed to save campaign',
        variant: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const triggerSectionTitle =
    formData.trigger_type === 'recurring'
      ? 'Recurring Schedule'
      : formData.trigger_type === 'reservation_range'
      ? 'Reservation Range'
      : formData.trigger_type === 'private_event'
      ? 'Private Event Selection'
      : formData.trigger_type === 'all_members'
      ? 'All Members Options'
      : undefined;

  return (
    <CampaignBuilderDialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title={isCreateMode ? 'Create New Campaign' : 'Edit Campaign'}
      footer={
        <DialogActions
          onCancel={onClose}
          onSave={handleSave}
          isSaving={isSaving}
          saveLabel={isCreateMode ? 'Create Campaign' : 'Update Campaign'}
        />
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-6">
          <FormSection title="Campaign Information">
            <Field label="Campaign Name" htmlFor="campaign-name" required>
              <TextField
                id="campaign-name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter campaign name"
              />
            </Field>

            <Field label="Description" htmlFor="campaign-description">
              <TextAreaField
                id="campaign-description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Enter campaign description"
                rows={3}
              />
            </Field>

            <Field label="Trigger Type" htmlFor="campaign-trigger" required>
              <SelectField
                id="campaign-trigger"
                value={formData.trigger_type}
                onChange={(e) => handleInputChange('trigger_type', e.target.value)}
              >
                {getTriggerTypeOptions().map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
            </Field>
          </FormSection>

          {formData.trigger_type && triggerSectionTitle && (
            <>
              <hr className="border-[#a59480]" />
              <FormSection title={triggerSectionTitle}>
                {renderTriggerTypeSpecificFields()}
              </FormSection>
            </>
          )}

          <hr className="border-[#a59480]" />

          <FormSection title="Locations">
            <CheckboxRow
              id="all-locations"
              checked={appliesToAllLocations}
              onChange={setAppliesToAllLocations}
              label="Apply to all locations"
            />

            {!appliesToAllLocations && (
              <div className="space-y-1">
                {locations.map((location) => (
                  <CheckboxRow
                    key={location.id}
                    id={`location-${location.id}`}
                    checked={selectedLocationIds.includes(location.id)}
                    onChange={(checked) =>
                      setSelectedLocationIds((prev) =>
                        checked
                          ? [...prev, location.id]
                          : prev.filter((id) => id !== location.id)
                      )
                    }
                    label={location.name}
                  />
                ))}
              </div>
            )}
          </FormSection>

          <hr className="border-[#a59480]" />

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
        </div>
      )}
    </CampaignBuilderDialog>
  );
};

export default CampaignDrawer;
