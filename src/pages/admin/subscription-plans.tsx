import { useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/useToast';
import AdminLayout from '../../components/layouts/AdminLayout';
import { SubscriptionPlan } from '../../types';
import { Settings, Plus, Pencil, Trash2, DollarSign, CreditCard } from 'lucide-react';
import { getSupabaseClient } from '../api/supabaseClient';

export default function SubscriptionPlansAdmin() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    plan_name: '',
    stripe_product_id: '',
    stripe_price_id: '',
    monthly_price: '',
    interval: 'month',
    is_active: true,
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
      stripe_product_id: '',
      stripe_price_id: '',
      monthly_price: '',
      interval: 'month',
      is_active: true,
      display_order: plans.length,
      description: ''
    });
    setIsModalOpen(true);
  }

  function openEditModal(plan: SubscriptionPlan) {
    setEditingPlan(plan);
    setFormData({
      plan_name: plan.plan_name,
      stripe_product_id: plan.stripe_product_id,
      stripe_price_id: plan.stripe_price_id,
      monthly_price: plan.monthly_price.toString(),
      interval: plan.interval,
      is_active: plan.is_active,
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

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(formData),
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
    <AdminLayout>
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Settings size={32} />
              Subscription Plans
            </h1>
            <p style={{ color: '#666' }}>
              Manage Stripe product and price ID mappings for membership plans
            </p>
          </div>
          <button
            onClick={openCreateModal}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#A59480',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: '500',
            }}
          >
            <Plus size={20} />
            Add Plan
          </button>
        </div>

        {/* Plans List */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
            <Spinner />
          </div>
        ) : plans.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '4rem',
            backgroundColor: '#f9fafb',
            borderRadius: '12px',
            border: '2px dashed #e5e7eb'
          }}>
            <CreditCard size={48} style={{ margin: '0 auto 1rem', color: '#9ca3af' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>No subscription plans yet</h3>
            <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
              Create your first subscription plan to start managing memberships
            </p>
            <button onClick={openCreateModal} style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#A59480',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500',
            }}>
              Create Plan
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {plans.map((plan) => (
              <div
                key={plan.id}
                style={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {/* Row 1: Name, Status, Price */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: '600', minWidth: '100px' }}>{plan.plan_name}</h3>
                    <span style={{
                      padding: '0.125rem 0.5rem',
                      backgroundColor: plan.is_active ? '#dcfce7' : '#fee2e2',
                      color: plan.is_active ? '#166534' : '#991b1b',
                      borderRadius: '9999px',
                      fontSize: '0.7rem',
                      fontWeight: '500',
                    }}>
                      {plan.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem', fontWeight: '600' }}>
                      <DollarSign size={14} />
                      ${plan.monthly_price.toFixed(2)}/{plan.interval}
                    </div>
                  </div>

                  {/* Row 2: Stripe IDs */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', fontSize: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ color: '#6b7280' }}>Product:</span>
                      <span style={{ fontFamily: 'monospace' }}>
                        {plan.stripe_product_id.startsWith('REPLACE') ? (
                          <span style={{ color: '#dc2626' }}>⚠️ Not configured</span>
                        ) : (
                          plan.stripe_product_id
                        )}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ color: '#6b7280' }}>Price:</span>
                      <span style={{ fontFamily: 'monospace' }}>
                        {plan.stripe_price_id.startsWith('REPLACE') ? (
                          <span style={{ color: '#dc2626' }}>⚠️ Not configured</span>
                        ) : (
                          plan.stripe_price_id
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                  <button
                    onClick={() => openEditModal(plan)}
                    style={{
                      padding: '0.375rem',
                      backgroundColor: 'transparent',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title="Edit plan"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(plan)}
                    style={{
                      padding: '0.375rem',
                      backgroundColor: 'transparent',
                      border: '1px solid #fee2e2',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      color: '#dc2626',
                    }}
                    title="Delete plan"
                  >
                    <Trash2 size={14} />
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
                userSelect: 'none',
                WebkitUserSelect: 'none',
                position: 'relative',
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
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
                      Stripe Product ID *
                    </label>
                    <input
                      type="text"
                      value={formData.stripe_product_id}
                      onChange={(e) => setFormData({ ...formData, stripe_product_id: e.target.value })}
                      required
                      placeholder="prod_xxxxxxxxxxxxx"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        fontFamily: 'monospace',
                        userSelect: 'text',
                        WebkitUserSelect: 'text',
                      }}
                    />
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                      Find this in Stripe Dashboard → Products
                    </p>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                      Stripe Price ID *
                    </label>
                    <input
                      type="text"
                      value={formData.stripe_price_id}
                      onChange={(e) => setFormData({ ...formData, stripe_price_id: e.target.value })}
                      required
                      placeholder="price_xxxxxxxxxxxxx"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        fontFamily: 'monospace',
                        userSelect: 'text',
                        WebkitUserSelect: 'text',
                      }}
                    />
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                      Find this under the product in Stripe Dashboard
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                        Interval *
                      </label>
                      <select
                        value={formData.interval}
                        onChange={(e) => setFormData({ ...formData, interval: e.target.value })}
                        required
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px',
                        }}
                      >
                        <option value="month">Monthly</option>
                        <option value="year">Yearly</option>
                      </select>
                    </div>

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
                        placeholder="100.00"
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px',
                        }}
                      />
                    </div>
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
    </AdminLayout>
  );
}
