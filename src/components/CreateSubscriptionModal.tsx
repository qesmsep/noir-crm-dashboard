import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/useToast';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from '../styles/UpdatePlanModal.module.css';

interface Plan {
  product_id: string;
  product_name: string;
  product_description: string | null;
  price_id: string;
  amount: number;
  currency: string;
  interval: string;
  interval_count: number;
  monthly_amount: number;
}

interface Props {
  accountId: string;
  onSuccess: () => void;
  onClose: () => void;
}

export default function CreateSubscriptionModal({ accountId, onSuccess, onClose }: Props) {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null);
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
        .eq('deactivated', false)
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
    if (!selectedPriceId) {
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
          price_id: selectedPriceId,
          charge_immediately: chargeImmediately,
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // If there's a client_secret, the subscription needs payment confirmation
      if (data.client_secret) {
        toast({
          title: 'Payment Required',
          description: 'Subscription created. Payment method needs to be added and confirmed.',
        });
      } else if (chargeImmediately) {
        toast({
          title: 'Success',
          description: 'Subscription created and charged successfully. Account is now active.',
        });
      } else {
        toast({
          title: 'Success',
          description: 'Subscription created successfully',
        });
      }

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

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  const formatInterval = (interval: string, interval_count: number) => {
    if (interval_count === 1) {
      return `per ${interval}`;
    }
    return `per ${interval_count} ${interval}s`;
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
                const isSelected = plan.price_id === selectedPriceId;

                return (
                  <div
                    key={plan.price_id}
                    className={`${styles.planCard} ${isSelected ? styles.selected : ''}`}
                    onClick={() => setSelectedPriceId(plan.price_id)}
                  >
                    <div className={styles.planHeader}>
                      <h3 className={styles.planName}>{plan.product_name}</h3>
                    </div>

                    {plan.product_description && (
                      <p className={styles.planDescription}>{plan.product_description}</p>
                    )}

                    <div className={styles.planPrice}>
                      <span className={styles.amount}>{formatCurrency(plan.amount, plan.currency)}</span>
                      <span className={styles.interval}>{formatInterval(plan.interval, plan.interval_count)}</span>
                    </div>

                    {plan.interval === 'year' && (
                      <div className={styles.monthlyEquivalent}>
                        {formatCurrency(plan.monthly_amount, plan.currency)}/month
                      </div>
                    )}

                    <div className={styles.radioButton}>
                      <input
                        type="radio"
                        name="plan"
                        checked={isSelected}
                        onChange={() => setSelectedPriceId(plan.price_id)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              id="chargeImmediately"
              checked={chargeImmediately}
              onChange={(e) => setChargeImmediately(e.target.checked)}
              disabled={submitting}
            />
            <label htmlFor="chargeImmediately" style={{ cursor: 'pointer', fontSize: '14px' }}>
              Charge immediately and activate (requires valid payment method)
            </label>
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button className={styles.cancelButton} onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button
              className={styles.submitButton}
              onClick={handleSubmit}
              disabled={submitting || !selectedPriceId || !primaryMemberId}
            >
              {submitting ? 'Creating...' : 'Create Subscription'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
