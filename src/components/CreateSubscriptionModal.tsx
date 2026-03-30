import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/useToast';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from '../styles/UpdatePlanModal.module.css';

interface Plan {
  id: string;
  plan_id: string;
  plan_name: string;
  description: string | null;
  monthly_price: number;
  beverage_credit: number;
  administrative_fee: number;
  additional_member_fee: number;
  interval: string;
  amount: number;
  annual_amount: number;
}

interface Props {
  accountId: string;
  onSuccess: () => void;
  onClose: () => void;
}

export default function CreateSubscriptionModal({ accountId, onSuccess, onClose }: Props) {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [primaryMemberId, setPrimaryMemberId] = useState<string | null>(null);
  const [chargeImmediately, setChargeImmediately] = useState(false);

  useEffect(() => {
    fetchPrimaryMember();
    fetchPlans();
  }, [accountId]);

  const fetchPrimaryMember = async () => {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('member_id')
        .eq('account_id', accountId)
        .eq('member_type', 'primary')
        .in('status', ['active', 'paused'])
        .single();

      if (error || !data) {
        throw new Error('Primary member not found for this account');
      }

      setPrimaryMemberId(data.member_id);
    } catch (error: any) {
      console.error('Error fetching primary member:', error);
      toast({
        title: 'Error',
        description: 'Failed to find primary member for this account',
        variant: 'error',
      });
    }
  };

  const fetchPlans = async () => {
    try {
      const response = await fetch('/api/subscriptions/plans');
      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      setPlans(result.plans || []);
    } catch (error: any) {
      console.error('Error fetching plans:', error);
      toast({
        title: 'Error',
        description: 'Failed to load subscription plans',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedPlanId) {
      toast({
        title: 'Info',
        description: 'Please select a plan',
      });
      return;
    }

    if (!primaryMemberId) {
      toast({
        title: 'Error',
        description: 'Primary member not found',
        variant: 'error',
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/subscriptions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: primaryMemberId,
          plan_id: selectedPlanId,
          charge_immediately: chargeImmediately,
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Success',
        description: data.message || 'Subscription created successfully',
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create subscription',
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatInterval = (interval: string) => {
    return `per ${interval}`;
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Create Subscription</h2>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>Loading plans...</div>
          ) : plans.length === 0 ? (
            <div className={styles.empty}>No subscription plans available</div>
          ) : (
            <div className={styles.planList}>
              {plans.map((plan) => {
                const isSelected = plan.plan_id === selectedPlanId;

                return (
                  <div
                    key={plan.plan_id}
                    className={`${styles.planCard} ${isSelected ? styles.selected : ''}`}
                    onClick={() => setSelectedPlanId(plan.plan_id)}
                  >
                    <div className={styles.planHeader}>
                      <h3 className={styles.planName}>{plan.plan_name}</h3>
                    </div>

                    {plan.description && (
                      <p className={styles.planDescription}>{plan.description}</p>
                    )}

                    <div className={styles.planPrice}>
                      <span className={styles.amount}>{formatCurrency(plan.amount)}</span>
                      <span className={styles.interval}>{formatInterval(plan.interval)}</span>
                    </div>

                    {plan.interval === 'year' && (
                      <div className={styles.monthlyEquivalent}>
                        {formatCurrency(plan.monthly_price / 12)}/month
                      </div>
                    )}

                    <div className={styles.radioButton}>
                      <input
                        type="radio"
                        name="plan"
                        checked={isSelected}
                        onChange={() => setSelectedPlanId(plan.plan_id)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <div style={{
            marginBottom: '16px',
            padding: '12px',
            background: '#F7F6F3',
            borderRadius: '8px',
            border: '1px solid #ECEAE5'
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#1F1F1F'
            }}>
              <input
                type="checkbox"
                id="chargeImmediately"
                checked={chargeImmediately}
                onChange={(e) => setChargeImmediately(e.target.checked)}
                disabled={submitting}
                style={{
                  width: '18px',
                  height: '18px',
                  cursor: 'pointer',
                  accentColor: '#A59480'
                }}
              />
              <span>
                <strong>Charge immediately</strong> (requires valid payment method on file)
              </span>
            </label>
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button className={styles.cancelButton} onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button
              className={styles.submitButton}
              onClick={handleSubmit}
              disabled={submitting || !selectedPlanId || !primaryMemberId}
            >
              {submitting ? 'Creating...' : 'Create Membership'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
