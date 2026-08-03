import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/useToast';

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

const RECURRING_SCHEDULE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'weekdays', label: 'Specific Weekdays' },
  { value: 'first_of_month', label: '1st of Month' },
  { value: 'last_of_month', label: 'Last Day of Month' },
];

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

  // Initialization effect: runs when drawer opens or mode/campaign changes
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

  // Fetch locations when drawer opens
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
            status: 'warning',
            duration: 5000,
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
        status: 'error',
        duration: 3000,
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

  const toggleWeekday = (value: string) => {
    const current: string[] = formData.recurring_schedule?.weekdays || [];
    const next = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    handleInputChange('recurring_schedule', { ...formData.recurring_schedule, weekdays: next });
  };

  const toggleLocation = (locationId: string) => {
    setSelectedLocationIds(prev =>
      prev.includes(locationId) ? prev.filter(id => id !== locationId) : [...prev, locationId]
    );
  };

  const renderTriggerTypeSpecificFields = () => {
    switch (formData.trigger_type) {
      case 'recurring':
        return (
          <div className="flex flex-col gap-4">
            <div>
              <Label className="text-[#a59480]">Recurring Schedule</Label>
              <div className="mt-2 flex flex-col gap-2">
                {RECURRING_SCHEDULE_OPTIONS.map(option => (
                  <label key={option.value} className="flex items-center gap-2 text-sm text-[#353535]">
                    <input
                      type="radio"
                      name="recurring_schedule_type"
                      className="h-4 w-4 accent-green-600"
                      checked={(formData.recurring_schedule?.type || 'weekly') === option.value}
                      onChange={() => handleInputChange('recurring_schedule', { ...formData.recurring_schedule, type: option.value })}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            {formData.recurring_schedule?.type === 'weekdays' && (
              <div>
                <Label className="text-[#a59480]">Select Weekdays</Label>
                <div className="mt-2 flex flex-col gap-2">
                  {WEEKDAYS.map((day, index) => (
                    <label key={day} className="flex items-center gap-2 text-sm text-[#353535]">
                      <Checkbox
                        checked={(formData.recurring_schedule?.weekdays || []).includes(String(index))}
                        onCheckedChange={() => toggleWeekday(String(index))}
                      />
                      {day}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-[#a59480]">Start Date</Label>
                <Input
                  type="date"
                  value={formData.recurring_start_date || ''}
                  onChange={(e) => handleInputChange('recurring_start_date', e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-[#a59480]">End Date (Optional)</Label>
                <Input
                  type="date"
                  value={formData.recurring_end_date || ''}
                  onChange={(e) => handleInputChange('recurring_end_date', e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        );

      case 'reservation_range':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-[#a59480]">Start Date &amp; Time</Label>
              <Input
                type="datetime-local"
                value={formData.reservation_range_start || ''}
                onChange={(e) => handleInputChange('reservation_range_start', e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-[#a59480]">End Date &amp; Time</Label>
              <Input
                type="datetime-local"
                value={formData.reservation_range_end || ''}
                onChange={(e) => handleInputChange('reservation_range_end', e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        );

      case 'private_event':
        return (
          <div>
            <Label className="text-[#a59480]">Select Private Event</Label>
            <Select
              value={formData.selected_private_event_id || ''}
              onChange={(e) => handleInputChange('selected_private_event_id', e.target.value)}
              className="mt-1"
            >
              <option value="" disabled>Select a private event</option>
              {privateEvents.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title} - {new Date(event.start_time).toLocaleDateString()}
                </option>
              ))}
            </Select>
          </div>
        );

      case 'all_members':
        return (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="include-event-list" className="text-[#a59480]">Include Event List</Label>
              <Switch
                id="include-event-list"
                checked={formData.include_event_list || false}
                onCheckedChange={(checked) => handleInputChange('include_event_list', checked)}
              />
            </div>

            {formData.include_event_list && (
              <div className="flex flex-col gap-4">
                <div>
                  <Label className="text-[#a59480]">Event Date Range</Label>
                  <Select
                    value={formData.event_list_date_range?.type || 'this_month'}
                    onChange={(e) => handleInputChange('event_list_date_range', {
                      ...formData.event_list_date_range,
                      type: e.target.value
                    })}
                    className="mt-1"
                  >
                    <option value="this_month">This Month</option>
                    <option value="next_month">Next Month</option>
                    <option value="specific_range">Specific Date Range</option>
                  </Select>
                </div>

                {formData.event_list_date_range?.type === 'specific_range' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-[#a59480]">Start Date</Label>
                      <Input
                        type="date"
                        value={formData.event_list_date_range?.start_date || ''}
                        onChange={(e) => handleInputChange('event_list_date_range', {
                          ...formData.event_list_date_range,
                          start_date: e.target.value
                        })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[#a59480]">End Date</Label>
                      <Input
                        type="date"
                        value={formData.event_list_date_range?.end_date || ''}
                        onChange={(e) => handleInputChange('event_list_date_range', {
                          ...formData.event_list_date_range,
                          end_date: e.target.value
                        })}
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
        status: 'error',
        duration: 3000,
      });
      return;
    }

    // Validate location selection
    if (!appliesToAllLocations && selectedLocationIds.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please select at least one location or enable "Apply to all locations"',
        status: 'error',
        duration: 3000,
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
        const errorText = await response.text();
        throw new Error('Failed to save campaign');
      }

      const result = await response.json();

      toast({
        title: 'Success',
        description: `Campaign ${isCreateMode ? 'created' : 'updated'} successfully`,
        status: 'success',
        duration: 3000,
      });

      onCampaignUpdated();
      onClose();
    } catch (error) {
      console.error('Error saving campaign:', error);
      toast({
        title: 'Error',
        description: 'Failed to save campaign',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsSaving(false);
    }
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
            {isCreateMode ? 'Create New Campaign' : 'Edit Campaign'}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-8">
          {isLoading ? (
            <div className="py-12 text-center text-[#353535]">Loading campaign...</div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Basic Information */}
              <div>
                <h3 className="mb-4 text-lg font-bold text-[#353535]">Campaign Information</h3>

                <div className="flex flex-col gap-4">
                  <div>
                    <Label className="text-[#a59480]">Campaign Name *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="Enter campaign name"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-[#a59480]">Description</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      placeholder="Enter campaign description"
                      rows={3}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-[#a59480]">Trigger Type *</Label>
                    <Select
                      value={formData.trigger_type}
                      onChange={(e) => handleInputChange('trigger_type', e.target.value)}
                      className="mt-1"
                    >
                      {getTriggerTypeOptions().map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>

              {/* Trigger Type Specific Fields */}
              {formData.trigger_type && (
                <>
                  <Separator className="bg-[#a59480]" />
                  <div>
                    <h3 className="mb-4 text-lg font-bold text-[#353535]">
                      {formData.trigger_type === 'recurring' && 'Recurring Schedule'}
                      {formData.trigger_type === 'reservation_range' && 'Reservation Range'}
                      {formData.trigger_type === 'private_event' && 'Private Event Selection'}
                      {formData.trigger_type === 'all_members' && 'All Members Options'}
                    </h3>
                    {renderTriggerTypeSpecificFields()}
                  </div>
                </>
              )}

              {/* Location Assignment */}
              <Separator className="bg-[#a59480]" />
              <div>
                <h3 className="mb-4 text-lg font-bold text-[#353535]">Locations</h3>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="all-locations" className="text-[#a59480]">Apply to all locations</Label>
                    <Switch
                      id="all-locations"
                      checked={appliesToAllLocations}
                      onCheckedChange={(checked) => setAppliesToAllLocations(checked)}
                    />
                  </div>

                  {!appliesToAllLocations && (
                    <div className="flex flex-col gap-2">
                      {locations.map((location) => (
                        <label key={location.id} className="flex items-center gap-2 text-[#353535]">
                          <Checkbox
                            checked={selectedLocationIds.includes(location.id)}
                            onCheckedChange={() => toggleLocation(location.id)}
                          />
                          {location.name}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Status */}
              <Separator className="bg-[#a59480]" />
              <div>
                <h3 className="mb-4 text-lg font-bold text-[#353535]">Status</h3>
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
            </div>
          )}
        </div>

        <SheetFooter className="shrink-0 flex-row gap-3 border-t px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:justify-end sm:space-x-0">
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
            {isSaving ? 'Saving...' : (isCreateMode ? 'Create Campaign' : 'Update Campaign')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default CampaignDrawer;
