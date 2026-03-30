'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/useToast';
import { getSupabaseClient } from '@/pages/api/supabaseClient';
import { Plus, Edit, Trash2, MessageSquare, UserPlus, Zap } from 'lucide-react';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const supabase = getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated — please log in again');
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  };
}

interface CampaignMessage {
  id?: string;
  message_content: string;
  delay_minutes: number;
  send_time: string | null;
  sort_order: number;
}

interface CampaignActions {
  create_onboarding_link?: { enabled: boolean; selected_membership?: string };
  add_ledger_charge?: { enabled: boolean; amount?: number; description?: string };
  create_event_rsvp?: { enabled: boolean; event_id?: string; party_size?: number };
}

interface IntakeCampaign {
  id: string;
  name: string;
  trigger_word: string;
  status: 'draft' | 'active' | 'inactive';
  message_count?: number;
  messages?: CampaignMessage[];
  actions?: CampaignActions;
  non_member_response?: string;
}

interface PrivateEvent {
  id: string;
  title: string;
  start_time: string;
  status: string;
  price_per_seat?: number;
}

interface SubscriptionPlan {
  id: string;
  plan_name: string;
  is_active: boolean;
}

type DelayPreset = 'immediate' | 'custom_minutes' | 'next_day_at' | 'days_at';

interface MessageFormState {
  message_content: string;
  delayPreset: DelayPreset;
  customMinutes: number;
  delayDays: number;
  sendTime: string;
}

function getDelayPreset(msg: CampaignMessage): { preset: DelayPreset; customMinutes: number; delayDays: number; sendTime: string } {
  if (msg.delay_minutes === 0 && !msg.send_time) {
    return { preset: 'immediate', customMinutes: 0, delayDays: 0, sendTime: '10:00' };
  }
  // <= 1440 with send_time = "next day at time" (1440 = exactly 1 day)
  // > 1440 with send_time = "N days at time"
  // Without send_time, any delay_minutes value (including 1440) = custom minutes
  if (msg.send_time && msg.delay_minutes <= 1440) {
    return { preset: 'next_day_at', customMinutes: 0, delayDays: 0, sendTime: msg.send_time };
  }
  if (msg.send_time && msg.delay_minutes > 1440) {
    return { preset: 'days_at', customMinutes: 0, delayDays: Math.floor(msg.delay_minutes / 1440), sendTime: msg.send_time };
  }
  return { preset: 'custom_minutes', customMinutes: msg.delay_minutes, delayDays: 0, sendTime: '10:00' };
}

function messageFormToData(form: MessageFormState, index: number): CampaignMessage {
  let delay_minutes = 0;
  let send_time: string | null = null;

  switch (form.delayPreset) {
    case 'immediate':
      delay_minutes = 0;
      break;
    case 'custom_minutes':
      delay_minutes = form.customMinutes;
      break;
    case 'next_day_at':
      delay_minutes = 1440; // 1 day in minutes
      send_time = form.sendTime;
      break;
    case 'days_at':
      delay_minutes = form.delayDays * 1440;
      send_time = form.sendTime;
      break;
  }

  return {
    message_content: form.message_content,
    delay_minutes,
    send_time,
    sort_order: index,
  };
}

function formatDelay(msg: CampaignMessage): string {
  if (msg.delay_minutes === 0 && !msg.send_time) return 'Immediately';
  if (msg.send_time) {
    const days = Math.floor(msg.delay_minutes / 1440);
    const timeStr = formatTime12h(msg.send_time);
    if (days <= 1) return `Next day at ${timeStr}`;
    return `${days} days later at ${timeStr}`;
  }
  if (msg.delay_minutes < 60) return `${msg.delay_minutes} min later`;
  if (msg.delay_minutes < 1440) {
    const hours = Math.floor(msg.delay_minutes / 60);
    const mins = msg.delay_minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m later` : `${hours}h later`;
  }
  const days = Math.floor(msg.delay_minutes / 1440);
  return `${days} day${days > 1 ? 's' : ''} later`;
}

function formatTime12h(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
}

const emptyMessageForm = (): MessageFormState => ({
  message_content: '',
  delayPreset: 'immediate',
  customMinutes: 30,
  delayDays: 2,
  sendTime: '10:00',
});

export default function IntakeCampaignManager() {
  const [campaigns, setCampaigns] = useState<IntakeCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<IntakeCampaign | null>(null);
  const [messageForms, setMessageForms] = useState<MessageFormState[]>([emptyMessageForm()]);
  const [saving, setSaving] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollCampaignId, setEnrollCampaignId] = useState<string>('');
  const [enrollPhone, setEnrollPhone] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [actions, setActions] = useState<CampaignActions>({});
  const [nonMemberResponse, setNonMemberResponse] = useState('');
  const [events, setEvents] = useState<PrivateEvent[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadCampaigns();
    loadEvents();
    loadPlans();
  }, []);

  const loadCampaigns = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/membership/intake-campaigns', { headers });
      if (response.ok) {
        const data = await response.json();
        setCampaigns(data);
      }
    } catch (error) {
      console.error('Error loading campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/private_events', { headers });
      if (response.ok) {
        const data = await response.json();
        setEvents((data || []).filter((e: PrivateEvent) => e.status === 'active'));
      } else {
        toast({ title: 'Warning', description: 'Failed to load events for campaign actions', variant: 'error' });
      }
    } catch (error) {
      console.error('Error loading events:', error);
      toast({ title: 'Warning', description: 'Failed to load events for campaign actions', variant: 'error' });
    }
  };

  const loadPlans = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/admin/subscription-plans', { headers });
      if (response.ok) {
        const data = await response.json();
        setPlans((data || []).filter((p: SubscriptionPlan) => p.is_active));
      } else {
        toast({ title: 'Warning', description: 'Failed to load subscription plans', variant: 'error' });
      }
    } catch (error) {
      console.error('Error loading plans:', error);
      toast({ title: 'Warning', description: 'Failed to load subscription plans', variant: 'error' });
    }
  };

  const handleCreate = () => {
    setEditingCampaign({
      id: '',
      name: '',
      trigger_word: '',
      status: 'draft',
    });
    setMessageForms([emptyMessageForm()]);
    setActions({});
    setNonMemberResponse('');
    setIsOpen(true);
  };

  const handleEdit = async (campaign: IntakeCampaign) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/membership/intake-campaigns?id=${campaign.id}`, { headers });
      if (response.ok) {
        const data = await response.json();
        setEditingCampaign(data);
        setActions(data.actions || {});
        setNonMemberResponse(data.non_member_response || '');
        if (data.messages && data.messages.length > 0) {
          setMessageForms(data.messages.map((msg: CampaignMessage) => {
            const { preset, customMinutes, delayDays, sendTime } = getDelayPreset(msg);
            return {
              message_content: msg.message_content,
              delayPreset: preset,
              customMinutes,
              delayDays,
              sendTime,
            };
          }));
        } else {
          setMessageForms([emptyMessageForm()]);
        }
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load campaign details', variant: 'error' });
    }
    setIsOpen(true);
  };

  const handleSave = async () => {
    if (!editingCampaign?.name || !editingCampaign?.trigger_word) {
      toast({ title: 'Error', description: 'Name and trigger word are required', variant: 'error' });
      return;
    }

    const validMessages = messageForms.filter(m => m.message_content.trim());
    if (validMessages.length === 0) {
      toast({ title: 'Error', description: 'At least one message is required', variant: 'error' });
      return;
    }

    setSaving(true);
    try {
      const messages = validMessages.map((form, index) => messageFormToData(form, index));
      const method = editingCampaign.id ? 'PUT' : 'POST';
      const body = {
        ...(editingCampaign.id ? { id: editingCampaign.id } : {}),
        name: editingCampaign.name,
        trigger_word: editingCampaign.trigger_word,
        status: editingCampaign.status,
        messages,
        actions,
        non_member_response: nonMemberResponse || null,
      };

      const headers = await getAuthHeaders();
      const response = await fetch('/api/membership/intake-campaigns', {
        method,
        headers,
        body: JSON.stringify(body),
      });

      if (response.ok) {
        toast({ title: 'Success', description: 'Campaign saved successfully' });
        setIsOpen(false);
        loadCampaigns();
      } else {
        const data = await response.json();
        toast({ title: 'Error', description: data.error || 'Failed to save campaign', variant: 'error' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save campaign', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/membership/intake-campaigns?id=${id}`, { method: 'DELETE', headers });
      if (response.ok) {
        toast({ title: 'Success', description: 'Campaign deleted' });
        loadCampaigns();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete campaign', variant: 'error' });
    }
  };

  const handleEnroll = async () => {
    if (!enrollPhone.trim() || !enrollCampaignId) {
      toast({ title: 'Error', description: 'Phone number is required', variant: 'error' });
      return;
    }

    // Basic phone format check — must have at least 10 digits
    const digits = enrollPhone.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) {
      toast({ title: 'Error', description: 'Please enter a valid phone number (10-15 digits)', variant: 'error' });
      return;
    }

    setEnrolling(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/membership/intake-enroll', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          campaign_id: enrollCampaignId,
          phone: enrollPhone.trim(),
          source: 'manual',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Success',
          description: data.message === 'Already enrolled'
            ? 'This phone is already enrolled in this campaign'
            : `Phone enrolled - ${data.messages_scheduled} message(s) scheduled`,
        });
        setEnrollOpen(false);
        setEnrollPhone('');
      } else {
        const data = await response.json();
        toast({ title: 'Error', description: data.error || 'Failed to enroll', variant: 'error' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to enroll phone number', variant: 'error' });
    } finally {
      setEnrolling(false);
    }
  };

  const addMessage = () => {
    setMessageForms(prev => [...prev, emptyMessageForm()]);
  };

  const removeMessage = (index: number) => {
    setMessageForms(prev => prev.filter((_, i) => i !== index));
  };

  const updateMessage = (index: number, updates: Partial<MessageFormState>) => {
    setMessageForms(prev => prev.map((m, i) => i === index ? { ...m, ...updates } : m));
  };

  if (loading) {
    return <p className="text-text-muted">Loading intake campaigns...</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-start gap-2 flex-wrap">
        <div className="flex flex-col gap-0.5 flex-1">
          <h2 className="text-lg md:text-xl font-semibold text-[#1F1F1F]">Intake Campaigns</h2>
          <p className="text-xs md:text-sm text-text-muted">
            Manage SMS trigger words and auto-response drip sequences
          </p>
        </div>
        <Button
          onClick={handleCreate}
          className="bg-cork text-white hover:bg-cork-dark rounded-lg shadow-lg text-sm px-3 py-2"
        >
          <Plus className="w-4 h-4 md:mr-2" />
          <span className="hidden md:inline">Create Campaign</span>
        </Button>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto bg-white rounded-2xl border border-border-cream-1">
        <table className="w-full">
          <thead className="bg-bg-cream-1">
            <tr>
              <th className="text-left p-4 text-sm font-semibold text-text-muted border-b-2 border-border-cream-1">Name</th>
              <th className="text-left p-4 text-sm font-semibold text-text-muted border-b-2 border-border-cream-1">Trigger Word</th>
              <th className="text-left p-4 text-sm font-semibold text-text-muted border-b-2 border-border-cream-1">Messages</th>
              <th className="text-left p-4 text-sm font-semibold text-text-muted border-b-2 border-border-cream-1">Status</th>
              <th className="text-left p-4 text-sm font-semibold text-text-muted border-b-2 border-border-cream-1">Actions</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-text-muted text-sm">
                  No intake campaigns yet. Create one to get started.
                </td>
              </tr>
            )}
            {campaigns.map((campaign) => (
              <tr key={campaign.id} className="hover:bg-[#FBFBFA] transition-colors">
                <td className="p-4 border-b border-[#EFEDE8]">
                  <span className="font-semibold text-[#1F1F1F]">{campaign.name}</span>
                </td>
                <td className="p-4 border-b border-[#EFEDE8]">
                  <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                    {campaign.trigger_word.toUpperCase()}
                  </code>
                </td>
                <td className="p-4 border-b border-[#EFEDE8] text-[#2C2C2C]">
                  <div className="flex items-center gap-1">
                    <MessageSquare className="w-4 h-4 text-text-muted" />
                    {campaign.message_count || 0}
                  </div>
                </td>
                <td className="p-4 border-b border-[#EFEDE8]">
                  <Badge className={`px-2 py-1 rounded ${
                    campaign.status === 'active' ? 'bg-green-100 text-green-800' :
                    campaign.status === 'draft' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {campaign.status}
                  </Badge>
                </td>
                <td className="p-4 border-b border-[#EFEDE8]">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleEdit(campaign)}
                      className="bg-cork text-white hover:bg-cork-dark shadow-sm"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setEnrollCampaignId(campaign.id);
                        setEnrollOpen(true);
                      }}
                      className="bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                      title="Enroll phone number"
                    >
                      <UserPlus className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleDelete(campaign.id)}
                      className="bg-red-600 text-white hover:bg-red-700 shadow-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="flex md:hidden flex-col gap-3">
        {campaigns.length === 0 && (
          <p className="text-center text-text-muted text-sm py-8">
            No intake campaigns yet. Create one to get started.
          </p>
        )}
        {campaigns.map((campaign) => (
          <Card key={campaign.id} className="bg-white p-4 rounded-2xl shadow-sm border border-border-cream-1">
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="font-semibold text-sm text-[#1F1F1F]">{campaign.name}</span>
                <div className="mt-1">
                  <code className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono">
                    {campaign.trigger_word.toUpperCase()}
                  </code>
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  onClick={() => handleEdit(campaign)}
                  className="bg-cork text-white hover:bg-cork-dark"
                >
                  <Edit className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setEnrollCampaignId(campaign.id);
                    setEnrollOpen(true);
                  }}
                  className="bg-blue-600 text-white hover:bg-blue-700"
                  title="Enroll phone number"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleDelete(campaign.id)}
                  className="bg-red-600 text-white hover:bg-red-700"
                  title="Delete campaign"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Badge className="px-2 py-1 rounded text-xs">
                <MessageSquare className="w-3 h-3 mr-1 inline" />
                {campaign.message_count || 0} msg{(campaign.message_count || 0) !== 1 ? 's' : ''}
              </Badge>
              <Badge className={`px-2 py-1 rounded text-xs ${
                campaign.status === 'active' ? 'bg-green-100 text-green-800' :
                campaign.status === 'draft' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {campaign.status}
              </Badge>
            </div>
          </Card>
        ))}
      </div>

      {/* Campaign Edit Sheet */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[550px] overflow-y-auto bg-white p-4">
          <SheetHeader className="pb-3">
            <SheetTitle className="text-lg font-semibold text-[#353535]">
              {editingCampaign?.id ? 'Edit Campaign' : 'Create Campaign'}
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-4 mt-3">
            {/* Campaign Details */}
            <div>
              <Label htmlFor="campaign-name" className="text-xs font-semibold text-[#353535]">Campaign Name</Label>
              <Input
                id="campaign-name"
                value={editingCampaign?.name || ''}
                onChange={(e) => setEditingCampaign(prev => prev ? { ...prev, name: e.target.value } : prev)}
                placeholder="e.g., Membership Inquiry"
                className="mt-1 text-sm h-9"
              />
            </div>

            <div>
              <Label htmlFor="trigger-word" className="text-xs font-semibold text-[#353535]">Trigger Word</Label>
              <Input
                id="trigger-word"
                value={editingCampaign?.trigger_word || ''}
                onChange={(e) => setEditingCampaign(prev => prev ? { ...prev, trigger_word: e.target.value.toUpperCase() } : prev)}
                placeholder="e.g., MEMBERSHIP"
                className="mt-1 text-sm h-9 font-mono uppercase"
              />
              <p className="text-xs text-text-muted mt-1">
                Case-insensitive. Triggered when the entire SMS message matches this word.
              </p>
            </div>

            <div>
              <Label htmlFor="campaign-status" className="text-xs font-semibold text-[#353535]">Status</Label>
              <Select
                id="campaign-status"
                value={editingCampaign?.status || 'draft'}
                onChange={(e) => setEditingCampaign(prev => prev ? { ...prev, status: e.target.value as IntakeCampaign['status'] } : prev)}
                className="mt-1 text-sm h-9"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </div>

            {/* Actions */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-[#353535]" />
                <Label className="text-xs font-semibold text-[#353535]">Actions (optional)</Label>
              </div>
              <p className="text-xs text-text-muted mb-3">
                Business logic that runs when someone is enrolled in this campaign.
              </p>

              <div className="flex flex-col gap-3">
                {/* Create Onboarding Link */}
                <div className="border border-border-cream-1 rounded-xl p-3 bg-[#FAFAF8]">
                  <div className="flex items-center gap-2 mb-2">
                    <Checkbox
                      id="action-onboarding"
                      checked={actions.create_onboarding_link?.enabled || false}
                      onCheckedChange={(checked) =>
                        setActions(prev => ({
                          ...prev,
                          create_onboarding_link: {
                            ...prev.create_onboarding_link,
                            enabled: checked as boolean,
                          },
                        }))
                      }
                    />
                    <Label htmlFor="action-onboarding" className="text-xs font-semibold text-[#353535] cursor-pointer">
                      Create Onboarding Link
                    </Label>
                  </div>
                  {actions.create_onboarding_link?.enabled && (
                    <div className="ml-6 flex flex-col gap-2">
                      <p className="text-xs text-text-muted">
                        Generates a 24-hour signup token and creates a waitlist entry.
                        Use <code className="bg-white px-1 rounded">{'{{onboard_url}}'}</code> in your messages.
                      </p>
                      <div>
                        <Label className="text-xs text-text-muted">Pre-select Membership Type (optional)</Label>
                        <Select
                          value={actions.create_onboarding_link?.selected_membership || ''}
                          onChange={(e) =>
                            setActions(prev => ({
                              ...prev,
                              create_onboarding_link: {
                                ...prev.create_onboarding_link,
                                enabled: true,
                                selected_membership: e.target.value || undefined,
                              },
                            }))
                          }
                          className="mt-1 text-sm h-8"
                        >
                          <option value="">None</option>
                          {plans.map(plan => (
                            <option key={plan.id} value={plan.plan_name}>{plan.plan_name}</option>
                          ))}
                        </Select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Add Ledger Charge */}
                <div className="border border-border-cream-1 rounded-xl p-3 bg-[#FAFAF8]">
                  <div className="flex items-center gap-2 mb-2">
                    <Checkbox
                      id="action-charge"
                      checked={actions.add_ledger_charge?.enabled || false}
                      onCheckedChange={(checked) =>
                        setActions(prev => ({
                          ...prev,
                          add_ledger_charge: {
                            ...prev.add_ledger_charge,
                            enabled: checked as boolean,
                          },
                        }))
                      }
                    />
                    <Label htmlFor="action-charge" className="text-xs font-semibold text-[#353535] cursor-pointer">
                      Add Ledger Charge
                    </Label>
                    <Badge className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px]">Members Only</Badge>
                  </div>
                  {actions.add_ledger_charge?.enabled && (
                    <div className="ml-6 flex flex-col gap-2">
                      <p className="text-xs text-text-muted">
                        Adds a charge to the member's account.
                        Use <code className="bg-white px-1 rounded">{'{{charge_amount}}'}</code> in your messages.
                      </p>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Label className="text-xs text-text-muted">Amount ($)</Label>
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={actions.add_ledger_charge?.amount || ''}
                            onChange={(e) =>
                              setActions(prev => ({
                                ...prev,
                                add_ledger_charge: {
                                  ...prev.add_ledger_charge,
                                  enabled: true,
                                  amount: parseFloat(e.target.value) || 0,
                                },
                              }))
                            }
                            className="mt-1 text-sm h-8"
                            placeholder="50.00"
                          />
                        </div>
                        <div className="flex-[2]">
                          <Label className="text-xs text-text-muted">Description</Label>
                          <Input
                            value={actions.add_ledger_charge?.description || ''}
                            onChange={(e) =>
                              setActions(prev => ({
                                ...prev,
                                add_ledger_charge: {
                                  ...prev.add_ledger_charge,
                                  enabled: true,
                                  description: e.target.value,
                                },
                              }))
                            }
                            className="mt-1 text-sm h-8"
                            placeholder="Event ticket, etc."
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Create Event RSVP */}
                <div className="border border-border-cream-1 rounded-xl p-3 bg-[#FAFAF8]">
                  <div className="flex items-center gap-2 mb-2">
                    <Checkbox
                      id="action-rsvp"
                      checked={actions.create_event_rsvp?.enabled || false}
                      onCheckedChange={(checked) =>
                        setActions(prev => ({
                          ...prev,
                          create_event_rsvp: {
                            ...prev.create_event_rsvp,
                            enabled: checked as boolean,
                          },
                        }))
                      }
                    />
                    <Label htmlFor="action-rsvp" className="text-xs font-semibold text-[#353535] cursor-pointer">
                      Create Event RSVP
                    </Label>
                    <Badge className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px]">Members Only</Badge>
                  </div>
                  {actions.create_event_rsvp?.enabled && (
                    <div className="ml-6 flex flex-col gap-2">
                      <p className="text-xs text-text-muted">
                        RSVPs the member to a private event and charges if the event has a per-seat price.
                        Use <code className="bg-white px-1 rounded">{'{{event_title}}'}</code> in your messages.
                      </p>
                      <div>
                        <Label className="text-xs text-text-muted">Private Event</Label>
                        <Select
                          value={actions.create_event_rsvp?.event_id || ''}
                          onChange={(e) =>
                            setActions(prev => ({
                              ...prev,
                              create_event_rsvp: {
                                ...prev.create_event_rsvp,
                                enabled: true,
                                event_id: e.target.value,
                              },
                            }))
                          }
                          className="mt-1 text-sm h-8"
                        >
                          <option value="">Select an event...</option>
                          {events.map(event => (
                            <option key={event.id} value={event.id}>
                              {event.title}{event.price_per_seat ? ` ($${event.price_per_seat}/seat)` : ''}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-text-muted">Party Size</Label>
                        <Input
                          type="number"
                          min={1}
                          value={actions.create_event_rsvp?.party_size || 1}
                          onChange={(e) =>
                            setActions(prev => ({
                              ...prev,
                              create_event_rsvp: {
                                ...prev.create_event_rsvp,
                                enabled: true,
                                party_size: parseInt(e.target.value) || 1,
                              },
                            }))
                          }
                          className="mt-1 text-sm h-8 w-24"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Non-member Response (shown when any members-only action is enabled) */}
                {(actions.add_ledger_charge?.enabled || actions.create_event_rsvp?.enabled) && (
                  <div className="border border-amber-200 rounded-xl p-3 bg-amber-50">
                    <Label className="text-xs font-semibold text-[#353535]">Non-Member Response</Label>
                    <p className="text-xs text-text-muted mt-1 mb-2">
                      Sent instead of the campaign messages when a non-member texts this trigger word.
                    </p>
                    <Textarea
                      value={nonMemberResponse}
                      onChange={(e) => setNonMemberResponse(e.target.value)}
                      placeholder="We apologize but our system cannot find this phone number registered to a member. Please text us to resolve this issue."
                      rows={3}
                      className="text-sm"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Template Variables Reference */}
            {(actions.create_onboarding_link?.enabled || actions.add_ledger_charge?.enabled || actions.create_event_rsvp?.enabled) && (
              <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                <p className="font-semibold mb-1">Available Template Variables:</p>
                <ul className="list-disc list-inside space-y-0.5 text-gray-700">
                  {actions.create_onboarding_link?.enabled && (
                    <li><code className="bg-white px-1 rounded">{'{{onboard_url}}'}</code> - Signup link (24hr expiry)</li>
                  )}
                  {(actions.add_ledger_charge?.enabled || actions.create_event_rsvp?.enabled) && (
                    <li><code className="bg-white px-1 rounded">{'{{member_name}}'}</code> - Member's first name</li>
                  )}
                  {actions.add_ledger_charge?.enabled && (
                    <li><code className="bg-white px-1 rounded">{'{{charge_amount}}'}</code> - Charge amount (e.g., $50.00)</li>
                  )}
                  {actions.create_event_rsvp?.enabled && (
                    <li><code className="bg-white px-1 rounded">{'{{event_title}}'}</code> - Event name</li>
                  )}
                </ul>
              </div>
            )}

            {/* Messages */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label className="text-xs font-semibold text-[#353535]">Messages</Label>
                <Button
                  type="button"
                  onClick={addMessage}
                  size="sm"
                  className="text-xs h-7 bg-cork text-white hover:bg-cork-dark"
                >
                  <Plus className="w-3 h-3 mr-1" /> Add Message
                </Button>
              </div>

              <div className="flex flex-col gap-4">
                {messageForms.map((form, index) => (
                  <div key={index} className="border border-border-cream-1 rounded-xl p-3 bg-[#FAFAF8]">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#353535]">
                          Message {index + 1}
                        </span>
                      </div>
                      {messageForms.length > 1 && (
                        <Button
                          type="button"
                          onClick={() => removeMessage(index)}
                          size="sm"
                          className="text-xs h-6 px-2 bg-red-100 text-red-700 hover:bg-red-200"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <Textarea
                        value={form.message_content}
                        onChange={(e) => updateMessage(index, { message_content: e.target.value })}
                        placeholder="Enter message text..."
                        rows={3}
                        className="text-sm"
                      />

                      <div>
                        <Label className="text-xs text-text-muted">Send Timing</Label>
                        <Select
                          value={form.delayPreset}
                          onChange={(e) => updateMessage(index, { delayPreset: e.target.value as DelayPreset })}
                          className="mt-1 text-sm h-8"
                        >
                          <option value="immediate">Immediately</option>
                          <option value="custom_minutes">After X minutes</option>
                          <option value="next_day_at">Next day at specific time</option>
                          <option value="days_at">X days later at specific time</option>
                        </Select>
                      </div>

                      {form.delayPreset === 'custom_minutes' && (
                        <div>
                          <Label className="text-xs text-text-muted">Minutes after trigger</Label>
                          <Input
                            type="number"
                            min={1}
                            value={form.customMinutes}
                            onChange={(e) => updateMessage(index, { customMinutes: parseInt(e.target.value) || 0 })}
                            className="mt-1 text-sm h-8 w-32"
                          />
                        </div>
                      )}

                      {form.delayPreset === 'days_at' && (
                        <div>
                          <Label className="text-xs text-text-muted">Days after trigger</Label>
                          <Input
                            type="number"
                            min={2}
                            value={form.delayDays}
                            onChange={(e) => updateMessage(index, { delayDays: parseInt(e.target.value) || 2 })}
                            className="mt-1 text-sm h-8 w-32"
                          />
                        </div>
                      )}

                      {(form.delayPreset === 'next_day_at' || form.delayPreset === 'days_at') && (
                        <div>
                          <Label className="text-xs text-text-muted">Send at (Central Time)</Label>
                          <Input
                            type="time"
                            value={form.sendTime}
                            onChange={(e) => updateMessage(index, { sendTime: e.target.value })}
                            className="mt-1 text-sm h-8 w-40"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <SheetFooter className="mt-4 pt-3 border-t gap-2">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="text-sm h-8"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="text-sm h-8"
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Enroll Phone Sheet */}
      <Sheet open={enrollOpen} onOpenChange={setEnrollOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[400px] overflow-y-auto bg-white p-4">
          <SheetHeader className="pb-3">
            <SheetTitle className="text-lg font-semibold text-[#353535]">
              Enroll Phone Number
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-3 mt-3">
            <p className="text-xs text-text-muted">
              Manually enroll a phone number into this campaign. They will receive all scheduled messages as if they had texted the trigger word.
            </p>
            <div>
              <Label htmlFor="enroll-phone" className="text-xs font-semibold text-[#353535]">Phone Number</Label>
              <Input
                id="enroll-phone"
                value={enrollPhone}
                onChange={(e) => setEnrollPhone(e.target.value)}
                placeholder="+1XXXXXXXXXX"
                className="mt-1 text-sm h-9"
              />
              <p className="text-xs text-text-muted mt-1">
                Use full format with country code (e.g., +18165551234)
              </p>
            </div>
          </div>

          <SheetFooter className="mt-4 pt-3 border-t gap-2">
            <Button
              variant="outline"
              onClick={() => { setEnrollOpen(false); setEnrollPhone(''); }}
              className="text-sm h-8"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEnroll}
              disabled={enrolling}
              className="text-sm h-8"
            >
              {enrolling ? 'Enrolling...' : 'Enroll'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
