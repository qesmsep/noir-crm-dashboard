import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { ArrowLeft, Pencil, Trash2, Plus } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import AdminLayout from '../../../components/layouts/AdminLayout';
import CampaignTemplateDrawer from '../../../components/CampaignTemplateDrawer';
import { sortCampaignTemplates } from '../../../utils/campaignSorting';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/useToast';

interface Campaign {
  id: string;
  name: string;
  description: string;
  trigger_type: 'member_signup' | 'member_birthday' | 'member_renewal' | 'reservation_time' | 'reservation_created' | 'reservation' | 'recurring' | 'reservation_range' | 'private_event' | 'all_members';
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

interface CampaignTemplate {
  id: string;
  campaign_id: string;
  name: string;
  description: string;
  content: string;
  recipient_type: 'member' | 'all_members' | 'specific_phone' | 'both_members' | 'reservation_phones' | 'private_event_rsvps' | 'all_primary_members';
  specific_phone?: string;
  timing_type: 'specific_time' | 'recurring' | 'relative';
  specific_time?: string;
  specific_date?: string;
  recurring_type?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  recurring_time?: string;
  recurring_weekdays?: number[];
  recurring_monthly_type?: 'first' | 'last' | 'second' | 'third' | 'fourth';
  recurring_monthly_day?: 'day' | 'weekday';
  recurring_monthly_value?: number;
  recurring_yearly_date?: string;
  relative_time?: string;
  relative_quantity?: number;
  relative_unit?: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
  relative_proximity?: 'before' | 'after';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function CampaignEditPage() {
  const router = useRouter();
  const { id } = router.query;
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isTemplateDrawerOpen, setIsTemplateDrawerOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isTemplateCreateMode, setIsTemplateCreateMode] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    if (id) {
      fetchCampaign();
    }
  }, [id]);

  useEffect(() => {
    if (campaign?.id) {
      fetchTemplates();
    }
  }, [campaign?.id]);

  const fetchCampaign = async () => {
    try {
      const response = await fetch(`/api/campaigns/${id}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data) {
        throw new Error('Campaign not found');
      }

      setCampaign(data);
    } catch (error) {
      console.error('Error fetching campaign:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch campaign',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await fetch(`/api/campaign-messages?campaign_id=${campaign?.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }
      const data = await response.json();

      // Sort templates by proximity to trigger event
      const sortedTemplates = sortCampaignTemplates(data);

      setTemplates(sortedTemplates);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch templates',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleCampaignUpdate = async (field: string, value: any) => {
    if (!campaign) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [field]: value }),
      });

      if (!response.ok) {
        throw new Error('Failed to update campaign');
      }

      // Get the updated campaign data from the server response
      const updatedCampaign = await response.json();
      setCampaign(updatedCampaign);

      toast({
        title: 'Success',
        description: 'Campaign updated successfully',
        status: 'success',
        duration: 2000,
      });
    } catch (error) {
      console.error('Error updating campaign:', error);
      toast({
        title: 'Error',
        description: 'Failed to update campaign',
        status: 'error',
        duration: 5000,
      });
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue);
  };

  const saveEdit = () => {
    if (editingField && campaign) {
      handleCampaignUpdate(editingField, editValue);
      setEditingField(null);
      setEditValue('');
    }
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const handleCreateMessage = () => {
    setIsTemplateCreateMode(true);
    setSelectedTemplateId(null);
    setIsTemplateDrawerOpen(true);
  };

  const handleEditTemplate = (template: CampaignTemplate) => {
    setIsTemplateCreateMode(false);
    setSelectedTemplateId(template.id);
    setIsTemplateDrawerOpen(true);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const response = await fetch(`/api/campaign-messages/${templateId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete template');
      }

      setTemplates(templates.filter(t => t.id !== templateId));
      toast({
        title: 'Success',
        description: 'Template deleted successfully',
        status: 'success',
        duration: 2000,
      });
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete template',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleToggleTemplateActive = async (template: CampaignTemplate) => {
    try {
      const response = await fetch(`/api/campaign-messages/${template.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: !template.is_active }),
      });

      if (!response.ok) {
        throw new Error('Failed to update template');
      }

      setTemplates(templates.map(t =>
        t.id === template.id ? { ...t, is_active: !t.is_active } : t
      ));

      toast({
        title: 'Success',
        description: `Template ${!template.is_active ? 'activated' : 'deactivated'} successfully`,
        status: 'success',
        duration: 2000,
      });
    } catch (error) {
      console.error('Error updating template:', error);
      toast({
        title: 'Error',
        description: 'Failed to update template',
        status: 'error',
        duration: 5000,
      });
    }
  };

  const handleTemplateUpdated = () => {
    fetchTemplates();
    setIsTemplateDrawerOpen(false);
  };

  const formatTiming = (template: CampaignTemplate) => {
    if (template.timing_type === 'specific_time') {
      // Convert 24-hour format to 12-hour format with AM/PM
      const time = template.specific_time || '10:00';
      const [hours, minutes] = time.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      const displayTime = `${displayHours}:${minutes.toString().padStart(2, '0')}${period}`;

      if (template.specific_date) {
        return `${displayTime} on ${template.specific_date}`;
      } else {
        return `${displayTime} on trigger date`;
      }
    } else if (template.timing_type === 'recurring') {
      const time = template.recurring_time || '10:00';
      const [hours, minutes] = time.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      const displayTime = `${displayHours}:${minutes.toString().padStart(2, '0')}${period}`;

      if (template.recurring_type === 'daily') {
        return `Daily at ${displayTime}`;
      } else if (template.recurring_type === 'weekly') {
        const days = template.recurring_weekdays?.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ') || 'selected days';
        return `Weekly on ${days} at ${displayTime}`;
      } else if (template.recurring_type === 'monthly') {
        const type = template.recurring_monthly_type || 'first';
        const day = template.recurring_monthly_day || 'day';
        const value = template.recurring_monthly_value || 1;
        return `Monthly on ${type} ${day} ${value} at ${displayTime}`;
      } else if (template.recurring_type === 'yearly') {
        return `Yearly on ${template.recurring_yearly_date} at ${displayTime}`;
      }
      return `Recurring at ${displayTime}`;
    } else if (template.timing_type === 'relative') {
      const time = template.relative_time || '10:00';
      const [hours, minutes] = time.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      const displayTime = `${displayHours}:${minutes.toString().padStart(2, '0')}${period}`;

      const quantity = template.relative_quantity || 0;
      const unit = template.relative_unit || 'day';
      const proximity = template.relative_proximity || 'after';

      if (quantity === 0) {
        return `${displayTime} on trigger date`;
      } else {
        const unitText = quantity === 1 ? unit : unit + 's';
        return `${displayTime} ${quantity} ${unitText} ${proximity} trigger`;
      }
    }
    return 'Timing not configured';
  };

  const formatRecipient = (template: CampaignTemplate) => {
    switch (template.recipient_type) {
      case 'member':
        return (campaign?.trigger_type === 'reservation' || campaign?.trigger_type === 'reservation_time' || campaign?.trigger_type === 'reservation_created') ? 'Phone number on reservation' : 'Primary Member';
      case 'all_members':
        return 'All Members';
      case 'specific_phone':
        return template.specific_phone || 'Custom Phone Number';
      default:
        return 'Unknown';
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="min-h-screen bg-gradient-to-br from-[#ECEDE8] to-white bg-fixed px-4 py-8 md:px-10 md:py-12">
          <p>Loading campaign...</p>
        </div>
      </AdminLayout>
    );
  }

  if (!campaign) {
    return (
      <AdminLayout>
        <div className="min-h-screen bg-gradient-to-br from-[#ECEDE8] to-white bg-fixed px-4 py-8 md:px-10 md:py-12">
          <p>Campaign not found</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-white px-4 py-8 md:px-10 md:py-12">
        <div className="flex flex-col gap-8">
          {/* Header */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/admin/communication')}
                aria-label="Back to campaigns"
                className="flex h-11 w-11 items-center justify-center rounded-md text-[#a59480] hover:bg-[#ecede8]"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="font-ivyjournal text-2xl font-bold tracking-tight text-[#353535] md:text-3xl">
                Edit Campaign
              </h1>
            </div>
            <Button
              onClick={handleCreateMessage}
              className="min-h-[44px] w-full rounded-xl bg-[#a59480] font-montserrat text-white shadow-[0_4px_15px_rgba(165,148,128,0.2)] hover:bg-[#8a7a66] md:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create New Message
            </Button>
          </div>

          {/* Condensed Campaign Details */}
          <div className="w-full overflow-hidden rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.15)]">
            <div className="bg-[#a59480] px-6 py-4">
              <p className="font-montserrat text-2xl font-bold tracking-wide text-white">Campaign Details</p>
            </div>
            <div className="bg-white px-6 py-6">
              <div className="flex flex-col gap-4">
                {saving && (
                  <div>
                    <Badge className="bg-blue-100 text-blue-800">Saving...</Badge>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Campaign ID */}
                  <div>
                    <p className="mb-1 font-montserrat text-sm text-[#666]">Campaign ID</p>
                    <p className="break-all font-montserrat font-bold text-[#353535]">{campaign.id}</p>
                  </div>
                  {/* Status */}
                  <div>
                    <p className="mb-1 font-montserrat text-sm text-[#666]">Status</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCampaignUpdate('is_active', !campaign.is_active)}
                      disabled={saving}
                      className={campaign.is_active
                        ? 'border-green-600 text-green-700 hover:bg-green-600 hover:text-white'
                        : 'border-red-600 text-red-700 hover:bg-red-600 hover:text-white'}
                    >
                      {campaign.is_active ? 'Active' : 'Inactive'}
                    </Button>
                  </div>
                  {/* Campaign Name */}
                  <div className="md:col-span-2">
                    <p className="mb-1 font-montserrat text-sm text-[#666]">Campaign Name *</p>
                    {editingField === 'name' ? (
                      <div className="flex flex-col gap-2 md:flex-row md:items-center">
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          placeholder="Enter campaign name"
                          className="flex-1"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveEdit} className="min-h-[44px] flex-1 bg-green-600 text-white hover:bg-green-700 md:flex-none">
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEdit} className="min-h-[44px] flex-1 md:flex-none">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-montserrat text-lg font-bold text-[#353535]">{campaign.name}</p>
                        <button
                          onClick={() => startEditing('name', campaign.name)}
                          aria-label="Edit campaign name"
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[#a59480] hover:bg-[#ecede8]"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  {/* Description */}
                  <div className="md:col-span-2">
                    <p className="mb-1 font-montserrat text-sm text-[#666]">Description</p>
                    {editingField === 'description' ? (
                      <div className="flex flex-col gap-2">
                        <Textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          rows={3}
                          placeholder="Enter campaign description"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveEdit} className="min-h-[44px] flex-1 bg-green-600 text-white hover:bg-green-700 md:flex-none">
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEdit} className="min-h-[44px] flex-1 md:flex-none">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-montserrat text-[#353535]">{campaign.description || 'No description'}</p>
                        <button
                          onClick={() => startEditing('description', campaign.description || '')}
                          aria-label="Edit description"
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[#a59480] hover:bg-[#ecede8]"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  {/* Trigger Type */}
                  <div className="md:col-span-2">
                    <p className="mb-1 font-montserrat text-sm text-[#666]">Trigger Type *</p>
                    {editingField === 'trigger_type' ? (
                      <div className="flex flex-col gap-2 md:flex-row md:items-center">
                        <Select
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="flex-1"
                        >
                          <option value="all_members">All Members</option>
                          <option value="member_birthday">Member Birthday</option>
                          <option value="member_renewal">Member Renewal Date</option>
                          <option value="member_signup">Member Signup</option>
                          <option value="private_event">Private Event</option>
                          <option value="recurring">Recurring</option>
                          <option value="reservation">Reservation</option>
                          <option value="reservation_created">Reservation Created</option>
                          <option value="reservation_range">Reservation Range</option>
                          <option value="reservation_time">Reservation Time</option>
                        </Select>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveEdit} className="min-h-[44px] flex-1 bg-green-600 text-white hover:bg-green-700 md:flex-none">
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEdit} className="min-h-[44px] flex-1 md:flex-none">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-montserrat font-bold text-[#353535]">
                          {campaign.trigger_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </p>
                        <button
                          onClick={() => startEditing('trigger_type', campaign.trigger_type)}
                          aria-label="Edit trigger type"
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[#a59480] hover:bg-[#ecede8]"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Message Templates */}
          <div className="w-full overflow-hidden rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.15)]">
            <div className="bg-[#a59480] px-6 py-4">
              <p className="font-montserrat text-2xl font-bold tracking-wide text-white">
                Message Templates ({templates.length})
              </p>
            </div>
            <div className="bg-white px-4 py-6 md:px-6">
              {templates.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="mb-4 font-montserrat text-xl text-[#666]">No message templates yet</p>
                  <p className="font-montserrat text-[#888]">
                    Create your first message template to start sending messages
                  </p>
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-[#f7f7f5]">
                          <th className="p-3 text-left font-montserrat font-bold text-[#353535]">Template Name</th>
                          <th className="p-3 text-left font-montserrat font-bold text-[#353535]">Description</th>
                          <th className="p-3 text-left font-montserrat font-bold text-[#353535]">Timing</th>
                          <th className="p-3 text-left font-montserrat font-bold text-[#353535]">Recipient</th>
                          <th className="p-3 text-left font-montserrat font-bold text-[#353535]">Status</th>
                          <th className="p-3 text-left font-montserrat font-bold text-[#353535]">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {templates.map((template) => (
                          <tr key={template.id} className="border-b border-[#ececec] hover:bg-[#f0f0f0]">
                            <td className="p-3 align-top font-montserrat font-bold text-[#353535]">{template.name}</td>
                            <td className="max-w-[300px] p-3 align-top font-montserrat text-[#353535]">
                              <p className="line-clamp-3 break-words">{template.description || '-'}</p>
                            </td>
                            <td className="max-w-[300px] p-3 align-top font-montserrat text-[#353535]">
                              <p className="line-clamp-2 break-words">{formatTiming(template)}</p>
                            </td>
                            <td className="p-3 align-top font-montserrat text-[#353535]">{formatRecipient(template)}</td>
                            <td className="p-3 align-top">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleToggleTemplateActive(template)}
                                className={template.is_active
                                  ? 'border-green-600 text-green-700 hover:bg-green-600 hover:text-white'
                                  : 'border-red-600 text-red-700 hover:bg-red-600 hover:text-white'}
                              >
                                {template.is_active ? 'Active' : 'Inactive'}
                              </Button>
                            </td>
                            <td className="p-3 align-top">
                              <div className="flex gap-2">
                                <button
                                  aria-label="Edit template"
                                  onClick={() => handleEditTemplate(template)}
                                  className="flex h-11 w-11 items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-700"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  aria-label="Delete template"
                                  onClick={() => handleDeleteTemplate(template.id)}
                                  className="flex h-11 w-11 items-center justify-center rounded-md bg-red-600 text-white hover:bg-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="flex flex-col gap-3 md:hidden">
                    {templates.map((template) => (
                      <div key={template.id} className="rounded-2xl border border-[#ececec] bg-white p-4 shadow-sm">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <p className="font-montserrat font-bold text-[#353535]">{template.name}</p>
                          <div className="flex gap-1">
                            <button
                              aria-label="Edit template"
                              onClick={() => handleEditTemplate(template)}
                              className="flex h-11 w-11 items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-700"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              aria-label="Delete template"
                              onClick={() => handleDeleteTemplate(template.id)}
                              className="flex h-11 w-11 items-center justify-center rounded-md bg-red-600 text-white hover:bg-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        {template.description && (
                          <p className="mb-2 font-montserrat text-sm text-[#666]">{template.description}</p>
                        )}
                        <div className="flex flex-col gap-1 font-montserrat text-sm text-[#353535]">
                          <p><span className="text-[#888]">Timing:</span> {formatTiming(template)}</p>
                          <p><span className="text-[#888]">Recipient:</span> {formatRecipient(template)}</p>
                        </div>
                        <div className="mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleTemplateActive(template)}
                            className={template.is_active
                              ? 'min-h-[44px] border-green-600 text-green-700 hover:bg-green-600 hover:text-white'
                              : 'min-h-[44px] border-red-600 text-red-700 hover:bg-red-600 hover:text-white'}
                          >
                            {template.is_active ? 'Active' : 'Inactive'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Template Drawer */}
        <CampaignTemplateDrawer
          isOpen={isTemplateDrawerOpen}
          onClose={() => setIsTemplateDrawerOpen(false)}
          templateId={selectedTemplateId}
          isCreateMode={isTemplateCreateMode}
          onTemplateUpdated={handleTemplateUpdated}
          campaignId={campaign.id}
          campaignTriggerType={campaign?.trigger_type}
        />
      </div>
    </AdminLayout>
  );
}
