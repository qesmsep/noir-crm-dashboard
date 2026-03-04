import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/useToast';
import styles from '../styles/MemberSubscriptionCard.module.css';
import UpdatePlanModal from './UpdatePlanModal';
import UpdatePaymentModal from './UpdatePaymentModal';

interface SubscriptionData {
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  subscription_start_date: string | null;
  subscription_cancel_at: string | null;
  next_renewal_date: string | null;
  monthly_dues: number | null;
  payment_method_type: string | null;
  payment_method_last4: string | null;
  payment_method_brand: string | null;
  current_price_id: string | null;
}

interface PaymentStatus {
  last_payment_status: string | null;
  last_payment_date: number | null;
  last_payment_amount: number | null;
  failed_payment_count: number;
}

interface Props {
  accountId: string;
  creditCardFeeEnabled?: boolean;
  updatingFeeToggle?: boolean;
  onToggleCreditCardFee?: () => void;
}

export default function MemberSubscriptionCard({
  accountId,
  creditCardFeeEnabled = false,
  updatingFeeToggle = false,
  onToggleCreditCardFee
}: Props) {
  const { toast } = useToast();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showUpdatePlanModal, setShowUpdatePlanModal] = useState(false);
  const [showUpdatePaymentModal, setShowUpdatePaymentModal] = useState(false);

  useEffect(() => {
    if (accountId) {
      fetchSubscriptionData();
      fetchPaymentStatus();
    }
  }, [accountId]);

  const fetchSubscriptionData = async () => {
    try {
      const response = await fetch(`/api/accounts/${accountId}`);
      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      // Extract subscription data from account
      const account = result.data;

      // If there's a subscription, fetch current price_id from Stripe
      let currentPriceId = null;
      if (account.stripe_subscription_id) {
        try {
          const subResponse = await fetch(`/api/subscriptions/${account.stripe_subscription_id}`);
          const subData = await subResponse.json();
          if (subData.subscription && subData.subscription.items?.data?.[0]?.price?.id) {
            currentPriceId = subData.subscription.items.data[0].price.id;
          }
        } catch (err) {
          console.error('Error fetching subscription price:', err);
        }
      }

      setSubscription({
        stripe_subscription_id: account.stripe_subscription_id || null,
        subscription_status: account.subscription_status || null,
        subscription_start_date: account.subscription_start_date || null,
        subscription_cancel_at: account.subscription_cancel_at || null,
        next_renewal_date: account.next_renewal_date || null,
        monthly_dues: account.monthly_dues || null,
        payment_method_type: account.payment_method_type || null,
        payment_method_last4: account.payment_method_last4 || null,
        payment_method_brand: account.payment_method_brand || null,
        current_price_id: currentPriceId,
      });
    } catch (error: any) {
      console.error('Error fetching subscription data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load subscription data',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentStatus = async () => {
    try {
      const response = await fetch(`/api/accounts/${accountId}/last-payment-status`);
      const result = await response.json();

      if (!result.error) {
        setPaymentStatus(result);
      }
    } catch (error: any) {
      console.error('Error fetching payment status:', error);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel this subscription at the end of the billing period?')) {
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch('/api/subscriptions/cancel', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId,
          cancel_at_period_end: true,
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Success',
        description: 'Subscription will be canceled at the end of the billing period',
      });

      fetchSubscriptionData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to cancel subscription',
        variant: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivateSubscription = async () => {
    setActionLoading(true);
    try {
      const response = await fetch('/api/subscriptions/reactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Success',
        description: 'Subscription reactivated successfully',
      });

      fetchSubscriptionData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reactivate subscription',
        variant: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePauseSubscription = async () => {
    if (!confirm('Are you sure you want to pause this subscription? Billing will be paused.')) {
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch('/api/subscriptions/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Success',
        description: 'Subscription paused successfully',
      });

      fetchSubscriptionData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to pause subscription',
        variant: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleResumeSubscription = async () => {
    setActionLoading(true);
    try {
      const response = await fetch('/api/subscriptions/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Success',
        description: 'Subscription resumed successfully',
      });

      fetchSubscriptionData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to resume subscription',
        variant: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <h3 className={styles.title}>Subscription</h3>
        </div>
        <div className={styles.loading}>Loading subscription data...</div>
      </div>
    );
  }

  if (!subscription || !subscription.stripe_subscription_id) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <h3 className={styles.title}>Subscription</h3>
        </div>
        <div className={styles.noSubscription}>
          <p>No active subscription</p>
          <button className={styles.createButton} onClick={() => {
            toast({ title: 'Info', description: 'Create subscription functionality coming soon' });
          }}>
            Create Subscription
          </button>
        </div>
      </div>
    );
  }

  const statusBadgeClass =
    subscription.subscription_status === 'active' ? styles.statusActive :
    subscription.subscription_status === 'canceled' ? styles.statusCanceled :
    subscription.subscription_status === 'past_due' ? styles.statusPastDue :
    subscription.subscription_status === 'paused' ? styles.statusPaused :
    styles.statusDefault;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '$0.00';
    return `$${amount.toFixed(2)}`;
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.title}>Subscription</h3>
        <div className={styles.badges}>
          {paymentStatus?.last_payment_status === 'failed' && (
            <span className={styles.paymentFailedBadge}>
              PAYMENT FAILED
            </span>
          )}
          <span className={statusBadgeClass}>
            {subscription.subscription_status?.toUpperCase()}
          </span>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.row}>
          <span className={styles.label}>MRR</span>
          <span className={styles.value}>{formatCurrency(subscription.monthly_dues)}/mo</span>
        </div>

        <div className={styles.row}>
          <span className={styles.label}>Start Date</span>
          <span className={styles.value}>{formatDate(subscription.subscription_start_date)}</span>
        </div>

        <div className={styles.row}>
          <span className={styles.label}>Next Renewal</span>
          <span className={styles.value}>{formatDate(subscription.next_renewal_date)}</span>
        </div>

        {subscription.subscription_cancel_at && (
          <div className={styles.row}>
            <span className={styles.label}>Cancels On</span>
            <span className={styles.valueWarning}>{formatDate(subscription.subscription_cancel_at)}</span>
          </div>
        )}

        {subscription.payment_method_type && (
          <div className={styles.row}>
            <span className={styles.label}>Payment Method</span>
            <span className={styles.value}>
              {subscription.payment_method_type === 'card' ? (
                <>
                  {subscription.payment_method_brand} •••• {subscription.payment_method_last4}
                </>
              ) : (
                <>
                  {subscription.payment_method_brand} •••• {subscription.payment_method_last4}
                </>
              )}
            </span>
          </div>
        )}
      </div>

      <div className={styles.actions}>
        {subscription.subscription_cancel_at ? (
          <button
            className={styles.reactivateButton}
            onClick={handleReactivateSubscription}
            disabled={actionLoading}
          >
            {actionLoading ? 'Processing...' : 'Reactivate'}
          </button>
        ) : subscription.subscription_status === 'paused' ? (
          <button
            className={styles.resumeButton}
            onClick={handleResumeSubscription}
            disabled={actionLoading}
          >
            {actionLoading ? 'Processing...' : 'Resume Subscription'}
          </button>
        ) : (
          <>
            <button
              className={styles.pauseButton}
              onClick={handlePauseSubscription}
              disabled={actionLoading}
            >
              {actionLoading ? 'Processing...' : 'Pause'}
            </button>
            <button
              className={styles.cancelButton}
              onClick={handleCancelSubscription}
              disabled={actionLoading}
            >
              {actionLoading ? 'Processing...' : 'Cancel'}
            </button>
          </>
        )}

        <button
          className={styles.updateButton}
          onClick={() => setShowUpdatePlanModal(true)}
        >
          Update Plan
        </button>

        <button
          className={styles.paymentButton}
          onClick={() => setShowUpdatePaymentModal(true)}
        >
          Update Payment
        </button>
      </div>

      {/* Payment Settings */}
      {onToggleCreditCardFee && (
        <div className={styles.paymentSettings}>
          <div className={styles.settingsDivider} />
          <div className={styles.settingsTitle}>Payment Settings</div>
          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>Credit Card Processing Fee</div>
              <div className={styles.settingDescription}>
                Add 4% fee to credit card transactions (ACH/bank transfers exempt)
              </div>
            </div>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={creditCardFeeEnabled}
                onChange={onToggleCreditCardFee}
                disabled={updatingFeeToggle}
                className={styles.toggleInput}
              />
              <span className={styles.toggleSlider}></span>
            </label>
          </div>
        </div>
      )}

      {showUpdatePlanModal && (
        <UpdatePlanModal
          accountId={accountId}
          currentPriceId={subscription.current_price_id}
          onSuccess={() => {
            fetchSubscriptionData();
            setShowUpdatePlanModal(false);
          }}
          onClose={() => setShowUpdatePlanModal(false)}
        />
      )}

      {showUpdatePaymentModal && (
        <UpdatePaymentModal
          accountId={accountId}
          onSuccess={() => {
            fetchSubscriptionData();
            setShowUpdatePaymentModal(false);
          }}
          onClose={() => setShowUpdatePaymentModal(false)}
        />
      )}
    </div>
  );
}
