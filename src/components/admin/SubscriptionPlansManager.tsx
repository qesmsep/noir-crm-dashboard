import { useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/useToast';
import { SubscriptionPlan } from '../../types';
import { Plus, Pencil, Trash2, DollarSign, CreditCard } from 'lucide-react';
import { getSupabaseClient } from '../../pages/api/supabaseClient';
import styles from '../../styles/SubscriptionPlansManager.module.css';

export default function SubscriptionPlansManager() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    plan_name: '',
    monthly_price: '',
    admin_fee: '', // UI uses admin_fee, calculated to beverage_credit on save
    additional_member_fee: '', // Fee per additional member
    interval: 'month',
    is_active: true,
    show_in_onboarding: true,
    display_order: 0,
    description: ''
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  async function fetchPlans() {
    try {
      setLoading(true);

      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const res = await fetch('/api/admin/subscription-plans', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to fetch plans');

      const result = await res.json();
      setPlans(result.data || []);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to load subscription plans',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingPlan(null);
    setFormData({
      plan_name: '',
      monthly_price: '',
      admin_fee: '',
      additional_member_fee: '25.00', // Default to $25/month
      interval: 'month',
      is_active: true,
      show_in_onboarding: true,
      display_order: plans.length,
      description: ''
    });
    setIsModalOpen(true);
  }

  function openEditModal(plan: SubscriptionPlan) {
    setEditingPlan(plan);
    // Calculate admin_fee from stored beverage_credit for display
    const adminFee = plan.beverage_credit !== undefined && plan.beverage_credit !== null
      ? (plan.monthly_price - plan.beverage_credit).toString()
      : '';

    setFormData({
      plan_name: plan.plan_name,
      monthly_price: plan.monthly_price.toString(),
      admin_fee: adminFee,
      additional_member_fee: ((plan as any).additional_member_fee || 0).toString(),
      interval: plan.interval,
      is_active: plan.is_active,
      show_in_onboarding: (plan as any).show_in_onboarding ?? true,
      display_order: plan.display_order,
      description: plan.description || ''
    });
    setIsModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const url = editingPlan
        ? `/api/admin/subscription-plans?id=${editingPlan.id}`
        : '/api/admin/subscription-plans';

      const method = editingPlan ? 'PUT' : 'POST';

      // Calculate beverage_credit from admin_fee for database storage
      const monthlyPrice = parseFloat(formData.monthly_price);
      const adminFee = parseFloat(formData.admin_fee || '0');
      const beverageCredit = monthlyPrice - adminFee;
      const additionalMemberFee = parseFloat(formData.additional_member_fee || '0');

      // Send data with beverage_credit (not admin_fee) since that's what DB expects
      const dataToSend = {
        ...formData,
        beverage_credit: beverageCredit.toFixed(2),
        additional_member_fee: additionalMemberFee.toFixed(2),
        admin_fee: undefined // Remove admin_fee from payload
      };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(dataToSend),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to save plan');
      }

      toast({
        title: 'Success',
        description: editingPlan ? 'Plan updated successfully' : 'Plan created successfully',
      });

      setIsModalOpen(false);
      fetchPlans();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(plan: SubscriptionPlan) {
    if (!confirm(`Are you sure you want to delete "${plan.plan_name}"? This cannot be undone.`)) {
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const res = await fetch(`/api/admin/subscription-plans?id=${plan.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete plan');
      }

      toast({
        title: 'Success',
        description: 'Plan deleted successfully',
      });

      fetchPlans();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'error',
      });
    }
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <h2>Subscription Plans</h2>
          <p>Manage Stripe product and price ID mappings for membership plans</p>
        </div>
        <button onClick={openCreateModal} className={styles.addButton}>
          <Plus size={20} />
          Add Plan
        </button>
      </div>

      {/* Plans List */}
      {loading ? (
        <div className={styles.loadingContainer}>
          <Spinner />
        </div>
      ) : plans.length === 0 ? (
        <div className={styles.emptyState}>
          <CreditCard size={48} />
          <h3>No subscription plans yet</h3>
          <p>Create your first subscription plan to start managing memberships</p>
          <button onClick={openCreateModal} className={styles.addButton}>
            Create Plan
          </button>
        </div>
      ) : (
        <div className={styles.plansGrid}>
          {plans.map((plan) => (
            <div key={plan.id} className={styles.planCard}>
              <div className={styles.planContent}>
                {/* Row 1: Name, Status, Price */}
                <div className={styles.planRow1}>
                  <h3 className={styles.planName}>{plan.plan_name}</h3>
                  <span className={`${styles.planStatus} ${plan.is_active ? styles.active : styles.inactive}`}>
                    {plan.is_active ? 'Active' : 'Inactive'}
                  </span>
                  {(plan as any).show_in_onboarding && (
                    <span className={`${styles.planStatus} ${styles.onboarding}`} title="Visible in onboarding">
                      📋 Onboarding
                    </span>
                  )}
                  <div className={styles.planPrice}>
                    <DollarSign size={14} />
                    ${plan.monthly_price.toFixed(2)}/{plan.interval}
                  </div>
                </div>

                {/* Beverage Credit & Admin Fee Breakdown */}
                {plan.beverage_credit !== undefined && plan.beverage_credit !== null && (
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
                    <div>💳 Beverage Credit: ${plan.beverage_credit.toFixed(2)}</div>
                    <div>⚙️ Admin Fee: ${(plan.monthly_price - plan.beverage_credit).toFixed(2)}</div>
                    {(plan as any).additional_member_fee > 0 && (
                      <div>👥 Additional Member: ${((plan as any).additional_member_fee || 0).toFixed(2)}/{plan.interval}</div>
                    )}
                  </div>
                )}

              </div>

              <div className={styles.planActions}>
                <button onClick={() => openEditModal(plan)} className={`${styles.actionButton} ${styles.edit}`} title="Edit plan">
                  <Pencil size={16} />
                  <span>Edit</span>
                </button>
                <button onClick={() => handleDelete(plan)} className={`${styles.actionButton} ${styles.delete}`} title="Delete plan">
                  <Trash2 size={16} />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onDragStart={(e) => e.preventDefault()}
          >
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
              {editingPlan ? 'Edit Subscription Plan' : 'Create Subscription Plan'}
            </h2>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                    Plan Name *
                  </label>
                  <input
                    type="text"
                    value={formData.plan_name}
                    onChange={(e) => setFormData({ ...formData, plan_name: e.target.value })}
                    required
                    placeholder="e.g., Skyline, Duo, Solo"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      userSelect: 'text',
                      WebkitUserSelect: 'text',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                    Interval *
                  </label>
                  <select
                    value={formData.interval}
                    onChange={(e) => {
                      const newInterval = e.target.value;
                      // Auto-adjust additional member fee based on interval
                      const currentFee = parseFloat(formData.additional_member_fee || '0');
                      let newFee = formData.additional_member_fee;

                      // If changing to yearly and fee looks like monthly rate, convert it
                      if (newInterval === 'year' && currentFee === 25) {
                        newFee = '300.00'; // 25 * 12
                      }
                      // If changing to monthly and fee looks like yearly rate, convert it
                      else if (newInterval === 'month' && currentFee === 300) {
                        newFee = '25.00'; // 300 / 12
                      }

                      setFormData({ ...formData, interval: newInterval, additional_member_fee: newFee });
                    }}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      userSelect: 'text',
                      WebkitUserSelect: 'text',
                    }}
                  >
                    <option value="month">Monthly</option>
                    <option value="year">Yearly</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                      {formData.interval === 'month' ? 'Monthly' : 'Yearly'} Price *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.monthly_price}
                      onChange={(e) => setFormData({ ...formData, monthly_price: e.target.value })}
                      required
                      placeholder="150.00"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        userSelect: 'text',
                        WebkitUserSelect: 'text',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                      {formData.interval === 'month' ? 'Monthly' : 'Yearly'} Administrative Fee
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.admin_fee}
                      onChange={(e) => setFormData({ ...formData, admin_fee: e.target.value })}
                      placeholder="50.00"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        userSelect: 'text',
                        WebkitUserSelect: 'text',
                      }}
                    />
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                      Beverage credit: ${formData.monthly_price && formData.admin_fee
                        ? (parseFloat(formData.monthly_price) - parseFloat(formData.admin_fee)).toFixed(2)
                        : '0.00'}
                    </p>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                    Additional Member Fee {formData.interval === 'year' ? '(per year)' : '(per month)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.additional_member_fee}
                    onChange={(e) => setFormData({ ...formData, additional_member_fee: e.target.value })}
                    placeholder={formData.interval === 'year' ? '300.00' : '25.00'}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      userSelect: 'text',
                      WebkitUserSelect: 'text',
                    }}
                  />
                  <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    {formData.interval === 'year'
                      ? 'Fee charged per additional member per year (typically $25/month × 12 = $300/year)'
                      : 'Fee charged per additional member per month (typically $25/month)'}
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optional description of plan features"
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      userSelect: 'text',
                      WebkitUserSelect: 'text',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    id="is_active"
                  />
                  <label htmlFor="is_active" style={{ fontWeight: '500' }}>
                    Active (available for new subscriptions)
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={formData.show_in_onboarding}
                    onChange={(e) => setFormData({ ...formData, show_in_onboarding: e.target.checked })}
                    id="show_in_onboarding"
                  />
                  <label htmlFor="show_in_onboarding" style={{ fontWeight: '500' }}>
                    Show in onboarding (visible to new members during signup)
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    backgroundColor: '#A59480',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontWeight: '500',
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? 'Saving...' : (editingPlan ? 'Update Plan' : 'Create Plan')}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    backgroundColor: 'transparent',
                    color: '#374151',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontWeight: '500',
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
