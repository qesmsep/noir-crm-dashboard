import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/useToast';
import { X } from 'lucide-react';
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
  currentPriceId: string | null;
  onSuccess: () => void;
  onClose: () => void;
}

export default function UpdatePlanModal({ accountId, currentPriceId, onSuccess, onClose }: Props) {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(currentPriceId);
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
    if (!selectedPriceId || selectedPriceId === currentPriceId) {
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
          new_price_id: selectedPriceId,
          proration_behavior: 'create_prorations',
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Success',
        description: 'Subscription plan updated successfully',
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
                const isCurrent = plan.price_id === currentPriceId;
                const isSelected = plan.price_id === selectedPriceId;

                return (
                  <div
                    key={plan.price_id}
                    className={`${styles.planCard} ${isSelected ? styles.selected : ''} ${isCurrent ? styles.current : ''}`}
                    onClick={() => setSelectedPriceId(plan.price_id)}
                  >
                    <div className={styles.planHeader}>
                      <h3 className={styles.planName}>{plan.product_name}</h3>
                      {isCurrent && <span className={styles.currentBadge}>Current Plan</span>}
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
          <button className={styles.cancelButton} onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            className={styles.submitButton}
            onClick={handleSubmit}
            disabled={submitting || !selectedPriceId || selectedPriceId === currentPriceId}
          >
            {submitting ? 'Updating...' : 'Update Plan'}
          </button>
        </div>
      </div>
    </div>
  );
}
