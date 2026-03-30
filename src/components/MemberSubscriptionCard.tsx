import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/useToast';
import { supabase } from '@/lib/supabase';
import styles from '../styles/MemberSubscriptionCard.module.css';
import UpdatePlanModal from './UpdatePlanModal';
import PaymentMethodModal from './member/PaymentMethodModal';
import CreateSubscriptionModal from './CreateSubscriptionModal';

interface SubscriptionData {
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  subscription_start_date: string | null;
  member_join_date: string | null;
  subscription_cancel_at: string | null;
  subscription_canceled_at: string | null;
  next_renewal_date: string | null;
  monthly_dues: number | null;
  payment_method_type: string | null;
  payment_method_last4: string | null;
  payment_method_brand: string | null;
  current_price_id: string | null;
  is_paused: boolean;
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
  totalLTV?: number;
}

export default function MemberSubscriptionCard({
  accountId,
  creditCardFeeEnabled = false,
  updatingFeeToggle = false,
  onToggleCreditCardFee,
  totalLTV = 0
}: Props) {
  const { toast } = useToast();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showUpdatePlanModal, setShowUpdatePlanModal] = useState(false);
  const [showUpdatePaymentModal, setShowUpdatePaymentModal] = useState(false);
  const [showCreateSubscriptionModal, setShowCreateSubscriptionModal] = useState(false);
  const [additionalMembersCount, setAdditionalMembersCount] = useState(0);
  const [baseMRR, setBaseMRR] = useState(0);
  const [additionalMemberFeeRate, setAdditionalMemberFeeRate] = useState(25);
  const [isExpanded, setIsExpanded] = useState(false);
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<{ type: string; message: string; details?: any } | null>(null);
  const [planName, setPlanName] = useState<string>('');
  const [beverageCredit, setBeverageCredit] = useState<number>(0);
  const [adminFee, setAdminFee] = useState<number>(0);

  useEffect(() => {
    if (accountId) {
      fetchSubscriptionData();
      fetchPaymentStatus();
      fetchPaymentErrors();
    }
  }, [accountId]);

  const fetchSubscriptionData = async () => {
    try {
      if (!accountId) {
        console.error('No account ID provided');
        return;
      }

      const response = await fetch(`/api/accounts/${accountId}?t=${Date.now()}`, {
        cache: 'no-store'
      });
      const result = await response.json();

      if (result.error) {
        console.error('Error fetching subscription data:', result.error, 'Account ID:', accountId);
        throw new Error(result.error);
      }

      // Extract subscription data from account
      const account = result.data;

      console.log('[MemberSubscriptionCard] Account data:', {
        subscription_start_date: account.subscription_start_date,
        next_billing_date: account.next_billing_date,
        subscription_status: account.subscription_status,
        monthly_dues: account.monthly_dues
      });

      // Fetch member count and plan details to calculate fees
      let secondaryMemberCount = 0;
      let planInterval = 'month'; // Default to monthly
      let planName = '';
      let primaryMemberJoinDate: string | null = null;

      try {
        // Get all members to find primary join date and count secondary members
        const { data: members, error: membersError } = await supabase
          .from('members')
          .select('member_id, member_type, status, join_date')
          .eq('account_id', accountId)
          .order('join_date', { ascending: true, nullsFirst: false });

        if (membersError) {
          console.error('Error fetching members:', membersError);
        } else if (members && members.length > 0) {
          // Use the earliest join_date from all members (sorted query)
          // Or find primary member if member_type is set
          const primaryMember = members.find(m => m.member_type === 'primary') || members[0];
          primaryMemberJoinDate = primaryMember.join_date || null;

          console.log('[MemberSubscriptionCard] Primary member join date:', {
            member: primaryMember,
            join_date: primaryMemberJoinDate
          });

          // Count active secondary members (status != 'archived')
          secondaryMemberCount = members.filter(m =>
            m.member_type === 'secondary' &&
            ['active', 'paused'].includes(m.status)
          ).length;
        } else {
          console.warn('[MemberSubscriptionCard] No members found for account:', accountId);
        }
      } catch (err) {
        console.error('Error fetching members:', err);
      }

      // Get plan details to check if it's annual and get base price
      let planBasePrice = 0;
      let planBeverageCredit = 0;
      let planAdminFee = 0;
      if (account.membership_plan_id) {
        try {
          const { data: plan, error: planError } = await supabase
            .from('subscription_plans')
            .select('interval, plan_name, monthly_price, beverage_credit, administrative_fee')
            .eq('id', account.membership_plan_id)
            .single();

          if (!planError && plan) {
            planInterval = plan.interval || 'month';
            planName = plan.plan_name || '';
            planBasePrice = Number(plan.monthly_price || 0);
            planBeverageCredit = Number(plan.beverage_credit || 0);
            planAdminFee = Number(plan.administrative_fee || 0);
          }
        } catch (err) {
          console.error('Error fetching plan:', err);
        }
      }

      // All subscriptions are now app-managed (no Stripe subscriptions)
      let isPaused = account.subscription_status === 'paused';

      // Calculate base and additional member fees
      // Base = plan's monthly_price, additional = monthly_dues - base
      const totalMRR = account.monthly_dues ? Number(account.monthly_dues) : 0;
      const calculatedBaseMRR = planBasePrice || totalMRR; // Use plan base price if available
      const additionalMemberCharges = Math.max(0, totalMRR - calculatedBaseMRR);

      // Determine additional member fee rate from the account's locked-in fee
      // Fee is already at the correct interval rate (e.g., $25/month or $300/year)
      const accountAdditionalMemberFee = Number(account.additional_member_fee || 0);
      const feeRate = accountAdditionalMemberFee;

      // Calculate how many additional members are being charged
      const chargedAdditionalMembers = feeRate > 0 ? Math.round(additionalMemberCharges / feeRate) : 0;

      setAdditionalMembersCount(chargedAdditionalMembers); // Show charged count, not actual member count
      setBaseMRR(calculatedBaseMRR);
      setAdditionalMemberFeeRate(feeRate);
      setBillingInterval(planInterval as 'month' | 'year');
      setCurrentPlanId(account.membership_plan_id || null);
      setPlanName(planName);
      setBeverageCredit(planBeverageCredit);
      setAdminFee(planAdminFee);

      const subscriptionData = {
        stripe_subscription_id: null, // No longer using Stripe subscriptions
        subscription_status: account.subscription_status || null,
        subscription_start_date: account.subscription_start_date || null,
        member_join_date: primaryMemberJoinDate,
        subscription_cancel_at: account.subscription_cancel_at || null,
        subscription_canceled_at: account.subscription_canceled_at || null,
        next_renewal_date: account.next_billing_date || null,
        monthly_dues: account.monthly_dues || null,
        payment_method_type: account.payment_method_type || null,
        payment_method_last4: account.payment_method_last4 || null,
        payment_method_brand: account.payment_method_brand || null,
        current_price_id: null, // No longer using Stripe price IDs
        is_paused: isPaused,
      };

      console.log('[MemberSubscriptionCard] Subscription data set:', {
        subscription_start_date: subscriptionData.subscription_start_date,
        next_renewal_date: subscriptionData.next_renewal_date,
      });

      setSubscription(subscriptionData);
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
      const response = await fetch(`/api/accounts/${accountId}/last-payment-status?t=${Date.now()}`, {
        cache: 'no-store'
      });
      const result = await response.json();

      if (!result.error) {
        setPaymentStatus(result);
      }
    } catch (error: any) {
      console.error('Error fetching payment status:', error);
    }
  };

  const fetchPaymentErrors = async () => {
    try {
      // Only show errors from the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('subscription_events')
        .select('event_type, effective_date, metadata')
        .eq('account_id', accountId)
        .eq('event_type', 'payment_failed')
        .gte('effective_date', thirtyDaysAgo.toISOString())
        .order('effective_date', { ascending: false })
        .limit(1)
        .single();

      if (!error && data && data.metadata) {
        const metadata = data.metadata as any;

        // Check if it's a payment_amount_mismatch error
        if (metadata.error === 'payment_amount_mismatch') {
          setPaymentError({
            type: 'payment_amount_mismatch',
            message: `Payment mismatch detected: Stripe charged $${metadata.stripe_amount?.toFixed(2)} but expected $${metadata.expected_amount?.toFixed(2)}`,
            details: metadata,
          });
        } else if (metadata.reason === 'no_payment_method') {
          setPaymentError({
            type: 'no_payment_method',
            message: 'No payment method on file',
            details: metadata,
          });
        } else if (metadata.decline_code || metadata.error_message) {
          setPaymentError({
            type: 'payment_declined',
            message: metadata.error_message || `Payment declined: ${metadata.decline_code}`,
            details: metadata,
          });
        }
      } else {
        setPaymentError(null);
      }
    } catch (error: any) {
      console.error('Error fetching payment errors:', error);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel this subscription immediately?')) {
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch('/api/subscriptions/cancel', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId,
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Success',
        description: 'Subscription canceled immediately',
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

  const handleRetryPayment = async () => {
    setActionLoading(true);
    try {
      const response = await fetch('/api/subscriptions/retry-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId }),
      });

      const data = await response.json();

      if (data.error || !data.success) {
        throw new Error(data.error || data.message || 'Payment failed');
      }

      toast({
        title: 'Success',
        description: 'Payment processed successfully - subscription reactivated',
      });

      fetchSubscriptionData();
      fetchPaymentStatus();
      fetchPaymentErrors(); // Clear error state on success
    } catch (error: any) {
      toast({
        title: 'Payment Failed',
        description: error.message || 'Failed to process payment',
        variant: 'error',
      });
      fetchPaymentErrors(); // Refresh error state to show new error if any
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <h3 className={styles.title}>Membership</h3>
        </div>
        <div className={styles.loading}>Loading membership data...</div>
      </div>
    );
  }

  // Check if there's a membership to display (including canceled ones)
  // Show membership card for any subscription with a status (active, canceled, past_due, paused, etc.)
  const hasMembership = subscription &&
    subscription.subscription_status;

  if (!subscription || !hasMembership) {
    return (
      <>
        <div className={styles.card}>
          <div className={styles.header}>
            <h3 className={styles.title}>Membership</h3>
          </div>
          <div className={styles.content}>
            <div className={styles.noSubscription}>
              <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '20px' }}>
                No membership plan configured for this account.
              </p>
              <button
                className={styles.createButton}
                onClick={() => setShowCreateSubscriptionModal(true)}
              >
                Create Membership
              </button>
            </div>
          </div>
        </div>

        {showCreateSubscriptionModal && (
          <CreateSubscriptionModal
            accountId={accountId}
            onSuccess={() => {
              fetchSubscriptionData();
              setShowCreateSubscriptionModal(false);
            }}
            onClose={() => setShowCreateSubscriptionModal(false)}
          />
        )}
      </>
    );
  }

  const statusBadgeClass =
    subscription.is_paused ? styles.statusPaused :
    (subscription.subscription_status === 'canceled' || subscription.subscription_cancel_at) ? styles.statusCanceled :
    subscription.subscription_status === 'active' ? styles.statusActive :
    subscription.subscription_status === 'processing' ? styles.statusActive :
    subscription.subscription_status === 'past_due' ? styles.statusPastDue :
    styles.statusDefault;

  const statusText =
    subscription.is_paused ? 'PAUSED' :
    (subscription.subscription_status === 'canceled' || subscription.subscription_cancel_at) ? 'CANCELLED' :
    subscription.subscription_status === 'processing' ? 'ACH PROCESSING' :
    subscription.subscription_status?.toUpperCase();

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    // Extract date portion to avoid timezone conversion issues
    // e.g., "2026-04-01T00:00:00+00" -> "2026-04-01"
    const datePart = dateStr.split('T')[0];
    const [year, month, day] = datePart.split('-');
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return date.toLocaleDateString('en-US', {
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
      <div className={styles.header} style={{ cursor: 'pointer' }} onClick={() => setIsExpanded(!isExpanded)}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <h3 className={styles.title}>Membership</h3>
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            style={{
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              flexShrink: 0,
            }}
          >
            <path d="M5 7.5L10 12.5L15 7.5" stroke="#86868b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>

      <div className={styles.content}>
        {/* Compact MRR/ARR and LTV Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: '500', marginBottom: '0.25rem' }}>
              {billingInterval === 'year' ? 'Total ARR' : 'Total MRR'}
            </div>
            <div style={{ fontSize: '1.125rem', color: '#1F1F1F', fontWeight: '700' }}>
              {formatCurrency(baseMRR + (additionalMembersCount * additionalMemberFeeRate))}/{billingInterval === 'year' ? 'yr' : 'mo'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: '500', marginBottom: '0.25rem' }}>Membership Fees Paid</div>
            <div style={{ fontSize: '1.125rem', color: '#1F1F1F', fontWeight: '700' }}>{formatCurrency(totalLTV)}</div>
          </div>
        </div>

        {/* Status Badges */}
        <div className={styles.badges} style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {paymentStatus?.last_payment_status === 'failed' && (
            <span className={styles.paymentFailedBadge}>
              PAYMENT FAILED
            </span>
          )}
          <span className={statusBadgeClass}>
            {statusText}
          </span>
          {(subscription.subscription_status === 'past_due' || paymentStatus?.last_payment_status === 'failed') && subscription.subscription_status !== 'processing' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRetryPayment();
              }}
              disabled={actionLoading}
              style={{
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '0.75rem',
                fontWeight: '600',
                cursor: actionLoading ? 'not-allowed' : 'pointer',
                opacity: actionLoading ? 0.6 : 1,
              }}
            >
              {actionLoading ? 'Processing...' : '🔄 Retry Payment'}
            </button>
          )}
        </div>

        {/* Payment Error Alert */}
        {paymentError && (
          <div
            style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FCA5A5',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#991B1B', marginBottom: '4px' }}>
                  {paymentError.type === 'payment_amount_mismatch' && 'Payment Processing Error'}
                  {paymentError.type === 'no_payment_method' && 'Missing Payment Method'}
                  {paymentError.type === 'payment_declined' && 'Payment Declined'}
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#7F1D1D', lineHeight: '1.4' }}>
                  {paymentError.message}
                </div>
                {paymentError.type === 'payment_amount_mismatch' && paymentError.details && (
                  <div style={{ fontSize: '0.75rem', color: '#991B1B', marginTop: '6px', fontFamily: 'monospace' }}>
                    Payment Intent: {paymentError.details.payment_intent_id}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className={styles.divider} style={{ margin: '0.75rem 0' }} />

        {/* Key Info - Always Visible */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8125rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#6B7280', fontWeight: '500' }}>Start Date</span>
            <span style={{ color: '#1F1F1F', fontWeight: '600' }}>{formatDate(subscription.member_join_date)}</span>
          </div>
          {subscription.subscription_status === 'canceled' && subscription.subscription_canceled_at ? (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6B7280', fontWeight: '500' }}>Canceled On</span>
              <span style={{ color: '#DC2626', fontWeight: '600' }}>{formatDate(subscription.subscription_canceled_at)}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6B7280', fontWeight: '500' }}>Next Renewal</span>
              <span style={{ color: '#1F1F1F', fontWeight: '600' }}>{formatDate(subscription.next_renewal_date)}</span>
            </div>
          )}
          {subscription.payment_method_type && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#6B7280', fontWeight: '500' }}>Payment Method</span>
              <span style={{ color: '#1F1F1F', fontWeight: '600' }}>
                {subscription.payment_method_type === 'card' ? (
                  <>{subscription.payment_method_brand} •••• {subscription.payment_method_last4}</>
                ) : (
                  <>{subscription.payment_method_brand} •••• {subscription.payment_method_last4}</>
                )}
              </span>
            </div>
          )}
        </div>

        {isExpanded && (
          <>
            <div className={styles.divider} style={{ marginTop: '0.75rem' }} />

            {/* Membership Plan */}
            <div className={styles.row}>
              <span className={styles.label}>{planName || 'Base Membership'}</span>
              <span className={styles.value}>
                {formatCurrency(baseMRR)}/{billingInterval === 'year' ? 'yr' : 'mo'}
              </span>
            </div>

            {/* Beverage Credit & Admin Fee Breakdown */}
            {beverageCredit > 0 && (
              <div style={{ fontSize: '0.8125rem', color: '#6B7280', marginLeft: '1rem', marginTop: '0.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span>💳 Beverage Credit</span>
                  <span>{formatCurrency(beverageCredit)}/{billingInterval === 'year' ? 'yr' : 'mo'}</span>
                </div>
                {adminFee > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>⚙️ Admin Fee</span>
                    <span>{formatCurrency(adminFee)}/{billingInterval === 'year' ? 'yr' : 'mo'}</span>
                  </div>
                )}
              </div>
            )}

            {/* Additional Members */}
            {additionalMembersCount > 0 && (
              <div className={styles.row}>
                <span className={styles.label}>
                  Additional Members ({additionalMembersCount} × ${additionalMemberFeeRate})
                </span>
                <span className={styles.value}>
                  {formatCurrency(additionalMembersCount * additionalMemberFeeRate)}/{billingInterval === 'year' ? 'yr' : 'mo'}
                </span>
              </div>
            )}

        {subscription.subscription_cancel_at && (
          <>
            <div className={styles.divider} />
            <div className={styles.row}>
              <span className={styles.label}>Cancels On</span>
              <span className={styles.valueWarning}>{formatDate(subscription.subscription_cancel_at)}</span>
            </div>
          </>
        )}
            <div className={styles.actions} onClick={(e) => e.stopPropagation()}>
        {subscription.subscription_status === 'canceled' ? (
          // Canceled: Only show Update Plan button (which will reactivate)
          <button
            className={styles.updateButton}
            onClick={() => setShowUpdatePlanModal(true)}
          >
            Update Plan
          </button>
        ) : subscription.is_paused ? (
          // Paused: Show Resume and Update Plan
          <>
            <button
              className={styles.resumeButton}
              onClick={handleResumeSubscription}
              disabled={actionLoading}
            >
              {actionLoading ? 'Processing...' : 'Resume Membership'}
            </button>
            <button
              className={styles.updateButton}
              onClick={() => setShowUpdatePlanModal(true)}
            >
              Update Plan
            </button>
          </>
        ) : (
          // Active: Show Pause, Cancel, and Update Plan
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
            <button
              className={styles.updateButton}
              onClick={() => setShowUpdatePlanModal(true)}
            >
              Update Plan
            </button>
          </>
        )}
      </div>

      {/* Payment Settings */}
      {onToggleCreditCardFee && (
        <div className={styles.paymentSettings} onClick={(e) => e.stopPropagation()}>
          <div className={styles.settingsDivider} />
          <div className={styles.settingsTitle}>Payment Settings</div>

          {/* Default Payment Method */}
          <div className={styles.settingRow}>
            <div className={styles.settingInfo}>
              <div className={styles.settingLabel}>Default Payment Method</div>
              <div className={styles.settingDescription}>
                {subscription.payment_method_type ? (
                  subscription.payment_method_type === 'card' ? (
                    <>{subscription.payment_method_brand} •••• {subscription.payment_method_last4}</>
                  ) : subscription.payment_method_type === 'us_bank_account' ? (
                    <>Bank Account •••• {subscription.payment_method_last4}</>
                  ) : (
                    <>{subscription.payment_method_brand} •••• {subscription.payment_method_last4}</>
                  )
                ) : (
                  'No payment method on file'
                )}
              </div>
            </div>
          </div>

          {/* Credit Card Fee Toggle */}
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
          <button
            className={styles.updatePaymentButton}
            onClick={() => setShowUpdatePaymentModal(true)}
          >
            Update Payment Method
          </button>
        </div>
      )}
          </>
        )}
      </div>

      {showUpdatePlanModal && (
        <UpdatePlanModal
          accountId={accountId}
          currentPlanId={currentPlanId}
          subscriptionStatus={subscription?.subscription_status || null}
          lastRenewalDate={subscription?.subscription_start_date || null}
          onSuccess={() => {
            fetchSubscriptionData();
            setShowUpdatePlanModal(false);
          }}
          onClose={() => setShowUpdatePlanModal(false)}
        />
      )}

      {showUpdatePaymentModal && (
        <PaymentMethodModal
          isOpen={showUpdatePaymentModal}
          onClose={() => {
            fetchSubscriptionData();
            setShowUpdatePaymentModal(false);
          }}
          accountId={accountId}
        />
      )}

      {showCreateSubscriptionModal && (
        <CreateSubscriptionModal
          accountId={accountId}
          onSuccess={() => {
            fetchSubscriptionData();
            setShowCreateSubscriptionModal(false);
          }}
          onClose={() => setShowCreateSubscriptionModal(false)}
        />
      )}
    </div>
  );
}
