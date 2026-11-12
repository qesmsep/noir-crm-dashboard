import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { supabase } from '@/lib/supabase';
import styles from '../styles/UpdatePlanModal.module.css';

interface Preview {
  interval: string;
  today: string;
  dues: number;
  creditCardFee: number;
  totalAmount: number;
  payment_method: { type: string; brand: string | null; last4: string | null } | null;
  charge_now_next_billing_date: string;
  next_cycle_billing_date: string;
}

interface Props {
  accountId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const money = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

// YYYY-MM-DD → "Sun, Nov 15, 2026" (built in local time, so no off-by-one from UTC parsing)
const longDate = (ymd: string) => {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
};

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Your session has expired. Sign in again.');
  return { Authorization: `Bearer ${session.access_token}` };
}

const methodLabel = (pm: Preview['payment_method']) => {
  if (!pm) return null;
  const name = pm.type === 'bank' ? (pm.brand || 'Bank account') : (pm.brand ? pm.brand[0].toUpperCase() + pm.brand.slice(1) : 'Card');
  return pm.last4 ? `${name} ending ${pm.last4}` : name;
};

export default function ResumeMembershipModal({ accountId, onSuccess, onClose }: Props) {
  const { toast } = useToast();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [choice, setChoice] = useState<'now' | 'next' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/subscriptions/resume?account_id=${encodeURIComponent(accountId)}`, {
          cache: 'no-store',
          headers: await authHeaders(),
        });
        const data = await response.json();
        if (!response.ok || data.error) throw new Error(data.error || 'Failed to load billing details');
        if (!cancelled) setPreview(data);
      } catch (error: any) {
        if (!cancelled) setLoadError(error.message);
      }
    })();
    return () => { cancelled = true; };
  }, [accountId]);

  const noDues = !!preview && preview.totalAmount <= 0;
  const noMethod = !!preview && !preview.payment_method && !noDues;
  const intervalWord = preview?.interval === 'year' ? 'annual' : 'monthly';

  const handleSubmit = async () => {
    if (!choice || submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch('/api/subscriptions/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ account_id: accountId, charge_now: choice === 'now' }),
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || 'Failed to resume membership');

      toast({ title: 'Membership resumed', description: data.message });
      for (const warning of data.warnings || []) {
        toast({ title: 'Needs attention', description: warning, variant: 'error' });
      }
      onSuccess();
    } catch (error: any) {
      toast({ title: 'Not resumed', description: error.message, variant: 'error' });
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={submitting ? undefined : onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Resume Membership</h2>
          <button className={styles.closeButton} onClick={onClose} disabled={submitting} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          {loadError ? (
            <div className={styles.empty}>{loadError}</div>
          ) : !preview ? (
            <div className={styles.loading}>Loading billing details...</div>
          ) : (
            <>
              <div className={styles.pricingSummary}>
                <div className={styles.summaryRow}>
                  <span>{intervalWord === 'annual' ? 'Annual' : 'Monthly'} dues</span>
                  <span>{money(preview.dues)}</span>
                </div>
                {preview.creditCardFee > 0 && (
                  <div className={styles.summaryRow}>
                    <span>Card processing fee</span>
                    <span>{money(preview.creditCardFee)}</span>
                  </div>
                )}
                <div className={`${styles.summaryRow} ${styles.total}`}>
                  <span>Total per charge</span>
                  <span>{money(preview.totalAmount)}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>Payment method</span>
                  <span>{methodLabel(preview.payment_method) || 'None on file'}</span>
                </div>
              </div>

              <div className={styles.paymentTiming}>
                <h4 className={styles.paymentTimingTitle}>When should we charge their dues?</h4>
                <div className={styles.paymentOptions}>
                  <label className={styles.paymentOption} style={noMethod ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
                    <input
                      type="radio"
                      name="resumeTiming"
                      checked={choice === 'now'}
                      disabled={noMethod || submitting}
                      onChange={() => setChoice('now')}
                    />
                    <div>
                      <div className={styles.optionTitle}>
                        {noDues ? 'Resume now' : `Charge ${money(preview.totalAmount)} now`}
                      </div>
                      <div className={styles.optionDescription}>
                        {noMethod
                          ? 'No payment method on file — add one first.'
                          : `Resumes once the charge succeeds. Next charge ${longDate(preview.charge_now_next_billing_date)}. If it fails, the membership stays paused.`}
                      </div>
                    </div>
                  </label>
                  <label className={styles.paymentOption}>
                    <input
                      type="radio"
                      name="resumeTiming"
                      checked={choice === 'next'}
                      disabled={submitting}
                      onChange={() => setChoice('next')}
                    />
                    <div>
                      <div className={styles.optionTitle}>
                        Charge on next billing date: {longDate(preview.next_cycle_billing_date)}
                      </div>
                      <div className={styles.optionDescription}>
                        Resumes now. No charge today; {noDues ? 'billing restarts' : `${money(preview.totalAmount)} is charged`} on {longDate(preview.next_cycle_billing_date)}.
                      </div>
                    </div>
                  </label>
                </div>
              </div>
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
            disabled={!preview || !choice || submitting}
          >
            {submitting
              ? (choice === 'now' && !noDues ? 'Charging...' : 'Resuming...')
              : choice === 'now' && !noDues
                ? `Charge ${money(preview!.totalAmount)} & Resume`
                : 'Resume Membership'}
          </button>
        </div>
      </div>
    </div>
  );
}
