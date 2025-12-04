import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';
import AdminLayout from '../../components/layouts/AdminLayout';
import CampaignDrawer from '../../components/CampaignDrawer';
import CampaignTemplateDrawer from '../../components/CampaignTemplateDrawer';
import { sortCampaignTemplates } from '../../utils/campaignSorting';
import styles from '../../styles/Communication.module.css';

interface Campaign {
  id: string;
  campaign_id: string;
  name: string;
  description: string;
  trigger_type: 'member_signup' | 'member_birthday' | 'member_renewal' | 'reservation_time' | 'reservation_created' | 'reservation' | 'recurring' | 'reservation_range' | 'private_event' | 'all_members';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  message_count?: number;
  recurring_schedule?: any;
  recurring_start_date?: string;
  recurring_end_date?: string;
  reservation_range_start?: string;
  reservation_range_end?: string;
  selected_private_event_id?: string;
  include_event_list?: boolean;
  event_list_date_range?: any;
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
  reservation_range_include_past?: boolean;
  reservation_range_minute_precision?: boolean;
  private_event_date_range?: any;
  private_event_include_old?: boolean;
}

export default function CommunicationPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignTemplates, setCampaignTemplates] = useState<CampaignTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [isCampaignDrawerOpen, setIsCampaignDrawerOpen] = useState(false);
  const [isTemplateDrawerOpen, setIsTemplateDrawerOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isCampaignCreateMode, setIsCampaignCreateMode] = useState(false);
  const [isTemplateCreateMode, setIsTemplateCreateMode] = useState(false);
  const [toast, setToast] = useState<{ title: string; description: string; status: string } | null>(null);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (title: string, description: string, status: string) => {
    setToast({ title, description, status });
  };

  const fetchCampaigns = async () => {
    try {
      const { data: campaignsData, error: campaignsError } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (campaignsError) {
        if (campaignsError.code === '42P01') {
          console.log('Campaigns table not found - run migration first');
          setCampaigns([]);
          return;
        }
        throw campaignsError;
      }

      const campaignsWithCounts = await Promise.all(
        (campaignsData || []).map(async (campaign) => {
          const { count, error: countError } = await supabase
            .from('campaign_messages')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', campaign.id);

          if (countError) {
            console.error(`Error fetching message count for campaign ${campaign.id}:`, countError);
            return { ...campaign, message_count: 0 };
          }

          return { ...campaign, message_count: count || 0 };
        })
      );

      setCampaigns(campaignsWithCounts);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      if (error.code !== '42P01') {
        showToast('Error', 'Failed to fetch campaigns', 'error');
      }
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCampaignTemplates = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/campaign-messages?campaign_id=${campaignId}`);
      if (!response.ok) throw new Error('Failed to fetch campaign templates');

      const data = await response.json();
      const sortedTemplates = sortCampaignTemplates(data || []);
      setCampaignTemplates(sortedTemplates);
    } catch (error) {
      console.error('Error fetching campaign templates:', error);
      showToast('Error', 'Failed to fetch campaign templates', 'error');
      setCampaignTemplates([]);
    }
  };

  const handleCreateCampaign = () => {
    setIsCampaignCreateMode(true);
    setSelectedCampaignId(null);
    setIsCampaignDrawerOpen(true);
  };

  const handleEditCampaign = (campaign: Campaign) => {
    router.push(`/admin/campaigns/${campaign.id}`);
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm('Are you sure you want to delete this campaign? This will also delete all associated templates.')) return;

    try {
      const { error } = await supabase.from('campaigns').delete().eq('id', id);
      if (error) throw error;

      showToast('Success', 'Campaign deleted successfully', 'success');
      fetchCampaigns();
    } catch (error) {
      console.error('Error deleting campaign:', error);
      showToast('Error', 'Failed to delete campaign', 'error');
    }
  };

  const handleToggleCampaignActive = async (campaign: Campaign) => {
    try {
      const { error } = await supabase
        .from('campaigns')
        .update({ is_active: !campaign.is_active })
        .eq('id', campaign.id);

      if (error) throw error;

      showToast('Success', `Campaign ${campaign.is_active ? 'deactivated' : 'activated'} successfully`, 'success');
      fetchCampaigns();
    } catch (error) {
      console.error('Error updating campaign:', error);
      showToast('Error', 'Failed to update campaign', 'error');
    }
  };

  const handleViewCampaignTemplates = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    fetchCampaignTemplates(campaign.id);
  };

  const handleCreateTemplate = () => {
    if (!selectedCampaign) return;
    setIsTemplateCreateMode(true);
    setSelectedTemplateId(null);
    setIsTemplateDrawerOpen(true);
  };

  const handleEditTemplate = (template: CampaignTemplate) => {
    setIsTemplateCreateMode(false);
    setSelectedTemplateId(template.id);
    setIsTemplateDrawerOpen(true);
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const response = await fetch(`/api/campaign-messages/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete template');

      showToast('Success', 'Template deleted successfully', 'success');
      if (selectedCampaign) fetchCampaignTemplates(selectedCampaign.id);
    } catch (error) {
      console.error('Error deleting template:', error);
      showToast('Error', 'Failed to delete template', 'error');
    }
  };

  const handleToggleTemplateActive = async (template: CampaignTemplate) => {
    try {
      const response = await fetch(`/api/campaign-messages/${template.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !template.is_active }),
      });

      if (!response.ok) throw new Error('Failed to update template');

      showToast('Success', `Template ${template.is_active ? 'deactivated' : 'activated'} successfully`, 'success');
      if (selectedCampaign) fetchCampaignTemplates(selectedCampaign.id);
    } catch (error) {
      console.error('Error updating template:', error);
      showToast('Error', 'Failed to update template', 'error');
    }
  };

  const formatTimingDisplay = (template: CampaignTemplate) => {
    if (template.timing_type === 'specific_time') {
      return `Send at ${template.specific_time} on ${template.specific_date || 'trigger date'}`;
    } else if (template.timing_type === 'recurring') {
      let display = `Send ${template.recurring_type} at ${template.recurring_time || '10:00'}`;
      if (template.recurring_type === 'weekly') {
        const days = template.recurring_weekdays?.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ') || 'selected days';
        display += ` on ${days}`;
      } else if (template.recurring_type === 'monthly') {
        display += ` on ${template.recurring_monthly_type} ${template.recurring_monthly_day} ${template.recurring_monthly_value}`;
      } else if (template.recurring_type === 'yearly') {
        display += ` on ${template.recurring_yearly_date}`;
      }
      return display;
    } else if (template.timing_type === 'relative') {
      const unit = template.relative_quantity === 1 ? template.relative_unit : template.relative_unit + 's';
      return `Send at ${template.relative_time} ${template.relative_quantity} ${unit} ${template.relative_proximity} trigger`;
    }
    return 'Timing not configured';
  };

  const formatRecipient = (template: CampaignTemplate) => {
    switch (template.recipient_type) {
      case 'member':
        return (selectedCampaign?.trigger_type === 'reservation' || selectedCampaign?.trigger_type === 'reservation_time' || selectedCampaign?.trigger_type === 'reservation_created') ? 'Phone number on reservation' : 'Primary Member';
      case 'all_members':
        return 'All Members';
      case 'specific_phone':
        return template.specific_phone || 'Custom Phone Number';
      default:
        return 'Unknown';
    }
  };

  const getTriggerLabel = (triggerType: string) => {
    const labels: Record<string, string> = {
      'member_signup': 'Member Signup',
      'member_birthday': 'Member Birthday',
      'member_renewal': 'Member Renewal',
      'reservation_time': 'Reservation Time',
      'reservation_created': 'Reservation Created',
      'reservation': 'Reservation',
      'recurring': 'Recurring',
      'reservation_range': 'Reservation Range',
      'private_event': 'Private Event',
      'all_members': 'All Members'
    };
    return labels[triggerType] || triggerType;
  };

  if (selectedCampaign) {
    return (
      <AdminLayout>
        <div className={styles.container}>
          <div className={styles.header}>
            <button onClick={() => setSelectedCampaign(null)} className={styles.backButton}>
              ← Back
            </button>
            <h1 className={styles.title}>{selectedCampaign.name}</h1>
          </div>

          <div className={styles.campaignInfo}>
            <div className={styles.infoRow}>
              <span className={styles.label}>Description:</span>
              <span className={styles.value}>{selectedCampaign.description || 'No description'}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.label}>Trigger:</span>
              <span className={styles.value}>{getTriggerLabel(selectedCampaign.trigger_type)}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.label}>Status:</span>
              <span className={`${styles.badge} ${selectedCampaign.is_active ? styles.active : styles.inactive}`}>
                {selectedCampaign.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Templates ({campaignTemplates.length})</h2>
              <button onClick={handleCreateTemplate} className={styles.addButton}>
                + Add Template
              </button>
            </div>

            {campaignTemplates.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>📧</div>
                <p className={styles.emptyText}>No templates yet</p>
                <p className={styles.emptySubtext}>Create your first template to start sending messages</p>
              </div>
            ) : (
              <div className={styles.cardList}>
                {campaignTemplates.sort((a, b) => a.name.localeCompare(b.name)).map((template) => (
                  <div key={template.id} className={styles.card}>
                    <div className={styles.cardHeader}>
                      <h3 className={styles.cardTitle}>{template.name}</h3>
                      <span className={`${styles.badge} ${template.is_active ? styles.active : styles.inactive}`}>
                        {template.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {template.description && (
                      <p className={styles.cardDescription}>{template.description}</p>
                    )}

                    <div className={styles.cardDetails}>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Timing:</span>
                        <span className={styles.detailValue}>{formatTimingDisplay(template)}</span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Recipient:</span>
                        <span className={styles.detailValue}>{formatRecipient(template)}</span>
                      </div>
                    </div>

                    <div className={styles.cardActions}>
                      <label className={styles.toggleLabel}>
                        <input
                          type="checkbox"
                          checked={template.is_active}
                          onChange={() => handleToggleTemplateActive(template)}
                          className={styles.toggleInput}
                        />
                        <span className={styles.toggleSlider}></span>
                        <span className={styles.toggleText}>Active</span>
                      </label>
                      <button onClick={() => handleEditTemplate(template)} className={styles.editButton}>
                        Edit
                      </button>
                      <button onClick={() => handleDeleteTemplate(template.id)} className={styles.deleteButton}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <CampaignTemplateDrawer
            isOpen={isTemplateDrawerOpen}
            onClose={() => setIsTemplateDrawerOpen(false)}
            templateId={selectedTemplateId}
            isCreateMode={isTemplateCreateMode}
            onTemplateUpdated={() => fetchCampaignTemplates(selectedCampaign.id)}
            campaignId={selectedCampaign.id}
            campaignTriggerType={selectedCampaign.trigger_type}
          />
        </div>

        {toast && (
          <div className={`${styles.toast} ${styles[toast.status]}`}>
            <strong>{toast.title}</strong>
            <p>{toast.description}</p>
          </div>
        )}
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className={styles.container}>
        {loading ? (
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p className={styles.loadingText}>Loading campaigns...</p>
          </div>
        ) : (
          <>
            <div className={styles.header}>
              <h1 className={styles.title}>Campaigns</h1>
              <button onClick={handleCreateCampaign} className={styles.primaryButton}>
                + Create Campaign
              </button>
            </div>

            {campaigns.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>📧</div>
                <p className={styles.emptyText}>No campaigns yet</p>
                <p className={styles.emptySubtext}>Create your first campaign to get started with automated messaging</p>
              </div>
            ) : (
              <div className={styles.cardList}>
                {campaigns.sort((a, b) => a.name.localeCompare(b.name)).map((campaign) => (
                  <div key={campaign.id} className={styles.card}>
                    <div className={styles.cardHeader}>
                      <h3 className={styles.cardTitle}>{campaign.name}</h3>
                      <span className={`${styles.badge} ${campaign.is_active ? styles.active : styles.inactive}`}>
                        {campaign.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {campaign.description && (
                      <p className={styles.cardDescription}>{campaign.description}</p>
                    )}

                    <div className={styles.cardDetails}>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Trigger:</span>
                        <span className={styles.detailValue}>{getTriggerLabel(campaign.trigger_type)}</span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Messages:</span>
                        <span className={styles.detailValue}>{campaign.message_count || 0}</span>
                      </div>
                    </div>

                    <div className={styles.cardActions}>
                      <label className={styles.toggleLabel}>
                        <input
                          type="checkbox"
                          checked={campaign.is_active}
                          onChange={() => handleToggleCampaignActive(campaign)}
                          className={styles.toggleInput}
                        />
                        <span className={styles.toggleSlider}></span>
                        <span className={styles.toggleText}>Active</span>
                      </label>
                      <button onClick={() => handleViewCampaignTemplates(campaign)} className={styles.viewButton}>
                        View
                      </button>
                      <button onClick={() => handleEditCampaign(campaign)} className={styles.editButton}>
                        Edit
                      </button>
                      <button onClick={() => handleDeleteCampaign(campaign.id)} className={styles.deleteButton}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <CampaignDrawer
          isOpen={isCampaignDrawerOpen}
          onClose={() => setIsCampaignDrawerOpen(false)}
          campaignId={selectedCampaignId}
          isCreateMode={isCampaignCreateMode}
          onCampaignUpdated={fetchCampaigns}
        />
      </div>

      {toast && (
        <div className={`${styles.toast} ${styles[toast.status]}`}>
          <strong>{toast.title}</strong>
          <p>{toast.description}</p>
        </div>
      )}
    </AdminLayout>
  );
}
