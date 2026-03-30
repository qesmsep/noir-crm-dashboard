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
  subscriptionStatus: string | null;
  lastRenewalDate: string | null;
  onSuccess: () => void;
  onClose: () => void;
}

export default function UpdatePlanModal({ accountId, currentPlanId, subscriptionStatus, lastRenewalDate, onSuccess, onClose }: Props) {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(currentPlanId);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [chargeToday, setChargeToday] = useState(true);
  const [additionalMemberCount, setAdditionalMemberCount] = useState<number>(0);
  const [currentSecondaryCount, setCurrentSecondaryCount] = useState<number>(0);

  useEffect(() => {
    fetchPlans();
    fetchCurrentMemberCount();
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

  const fetchCurrentMemberCount = async () => {
    try {
      const response = await fetch(`/api/accounts/${accountId}`);
      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      // Get the count of secondary members from the account
      const account = result.data;
      const secondaryCount = account.secondary_member_count || 0;
      setCurrentSecondaryCount(secondaryCount);
      setAdditionalMemberCount(secondaryCount); // Pre-populate with current count
    } catch (error: any) {
      console.error('Error fetching member count:', error);
      // Don't show error toast for this, just default to 0
    }
  };

  const handleSubmit = async () => {
    if (!selectedPlanId || (selectedPlanId === currentPlanId && subscriptionStatus === 'active')) {
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
          charge_today: chargeToday,
          additional_member_count: additionalMemberCount,
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
            <>
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
                        {isCurrent && subscriptionStatus === 'active' && <span className={styles.currentBadge}>Current Plan</span>}
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

              {/* Additional Members Section */}
              {selectedPlanId && (
                <div className={styles.additionalMembersSection}>
                  <h4 className={styles.sectionTitle}>Additional Members</h4>
                  <p className={styles.sectionDescription}>
                    Specify how many additional members to bill for at ${plans.find(p => p.plan_id === selectedPlanId)?.additional_member_fee || 25}/month each
                  </p>
                  <div className={styles.memberCountInput} onClick={(e) => e.stopPropagation()}>
                    <label className={styles.inputLabel}>Number of Additional Members:</label>
                    <input
                      type="number"
                      min="0"
                      className={styles.numberInput}
                      value={additionalMemberCount}
                      onChange={(e) => setAdditionalMemberCount(Math.max(0, parseInt(e.target.value) || 0))}
                      onMouseDown={(e) => e.stopPropagation()}
                    />
                    {currentSecondaryCount > 0 && currentSecondaryCount !== additionalMemberCount && (
                      <div className={styles.memberCountNote}>
                        Note: Account has {currentSecondaryCount} member{currentSecondaryCount !== 1 ? 's' : ''} in the system
                      </div>
                    )}
                  </div>
                  {selectedPlanId && additionalMemberCount > 0 && (
                    <div className={styles.pricingSummary}>
                      <div className={styles.summaryRow}>
                        <span>Base Plan:</span>
                        <span>{formatCurrency(plans.find(p => p.plan_id === selectedPlanId)?.monthly_price || 0)}</span>
                      </div>
                      <div className={styles.summaryRow}>
                        <span>Additional Members ({additionalMemberCount} × ${plans.find(p => p.plan_id === selectedPlanId)?.additional_member_fee || 25}):</span>
                        <span>{formatCurrency((plans.find(p => p.plan_id === selectedPlanId)?.additional_member_fee || 25) * additionalMemberCount)}</span>
                      </div>
                      <div className={`${styles.summaryRow} ${styles.total}`}>
                        <span>Total Monthly Dues:</span>
                        <span>{formatCurrency((plans.find(p => p.plan_id === selectedPlanId)?.monthly_price || 0) + ((plans.find(p => p.plan_id === selectedPlanId)?.additional_member_fee || 25) * additionalMemberCount))}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {subscriptionStatus === 'canceled' && (
                <div className={styles.paymentTiming}>
                  <h4 className={styles.paymentTimingTitle}>Payment Timing</h4>
                  <div className={styles.paymentOptions}>
                    <label className={styles.paymentOption}>
                      <input
                        type="radio"
                        name="paymentTiming"
                        checked={chargeToday}
                        onChange={() => setChargeToday(true)}
                      />
                      <div>
                        <div className={styles.optionTitle}>Charge Today</div>
                        <div className={styles.optionDescription}>Reactivate and charge immediately</div>
                      </div>
                    </label>
                    <label className={styles.paymentOption}>
                      <input
                        type="radio"
                        name="paymentTiming"
                        checked={!chargeToday}
                        onChange={() => setChargeToday(false)}
                      />
                      <div>
                        <div className={styles.optionTitle}>Pay on Next Renewal Date</div>
                        <div className={styles.optionDescription}>Reactivate now, charge on next billing cycle</div>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelButton} onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            className={styles.submitButton}
            onClick={handleSubmit}
            disabled={submitting || !selectedPlanId || (selectedPlanId === currentPlanId && subscriptionStatus === 'active')}
          >
            {submitting ? (subscriptionStatus === 'canceled' ? 'Reactivating...' : 'Updating...') : (subscriptionStatus === 'canceled' ? 'Reactivate & Update Plan' : 'Update Plan')}
          </button>
        </div>
      </div>
    </div>
  );
}
