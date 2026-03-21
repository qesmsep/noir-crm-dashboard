import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/useToast';
import { X } from 'lucide-react';
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
  currentPlanId: string | null;
  onSuccess: () => void;
  onClose: () => void;
}

export default function UpdatePlanModal({ accountId, currentPlanId, onSuccess, onClose }: Props) {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(currentPlanId);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

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
    if (!selectedPlanId || selectedPlanId === currentPlanId) {
      toast({
        title: 'Info',
        description: 'Please select a different plan',
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/subscriptions/update-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId,
          new_plan_id: selectedPlanId,
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Success',
        description: data.message || 'Subscription plan updated successfully',
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update subscription plan',
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
          <h2 className={styles.title}>Update Subscription Plan</h2>
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
                const isCurrent = plan.plan_id === currentPlanId;
                const isSelected = plan.plan_id === selectedPlanId;

                return (
                  <div
                    key={plan.plan_id}
                    className={`${styles.planCard} ${isSelected ? styles.selected : ''} ${isCurrent ? styles.current : ''}`}
                    onClick={() => setSelectedPlanId(plan.plan_id)}
                  >
                    <div className={styles.planHeader}>
                      <h3 className={styles.planName}>{plan.plan_name}</h3>
                      {isCurrent && <span className={styles.currentBadge}>Current Plan</span>}
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
          <button className={styles.cancelButton} onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            className={styles.submitButton}
            onClick={handleSubmit}
            disabled={submitting || !selectedPlanId || selectedPlanId === currentPlanId}
          >
            {submitting ? 'Updating...' : 'Update Plan'}
          </button>
        </div>
      </div>
    </div>
  );
}
