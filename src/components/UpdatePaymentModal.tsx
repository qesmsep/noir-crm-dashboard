import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/useToast';
import { X, CreditCard } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import styles from '../styles/UpdatePaymentModal.module.css';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface PaymentMethod {
  id: string;
  card: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
  billing_details: {
    name: string;
  };
}

interface Props {
  accountId: string;
  onSuccess: () => void;
  onClose: () => void;
}

function UpdatePaymentForm({ accountId, onSuccess, onClose }: Props) {
  const { toast } = useToast();
  const stripe = useStripe();
  const elements = useElements();
  const [currentPaymentMethod, setCurrentPaymentMethod] = useState<PaymentMethod | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCurrentPaymentMethod();
  }, []);

  const fetchCurrentPaymentMethod = async () => {
    try {
      const response = await fetch(`/api/stripe/payment-methods/list?account_id=${accountId}`);
      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      // Get the default payment method
      const defaultId = result.default_payment_method_id;
      if (defaultId && result.payment_methods) {
        const defaultMethod = result.payment_methods.find((pm: PaymentMethod) => pm.id === defaultId);
        setCurrentPaymentMethod(defaultMethod || null);
      }
    } catch (error: any) {
      console.error('Error fetching payment method:', error);
      // Don't show error toast here, user might not have a payment method yet
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      return;
    }

    setSubmitting(true);

    try {
      // Step 1: Create SetupIntent
      const setupResponse = await fetch('/api/stripe/payment-methods/setup-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId }),
      });

      const setupData = await setupResponse.json();

      if (setupData.error) {
        throw new Error(setupData.error);
      }

      // Step 2: Confirm card setup with Stripe
      const { setupIntent, error: stripeError } = await stripe.confirmCardSetup(
        setupData.client_secret,
        {
          payment_method: {
            card: cardElement,
          },
        }
      );

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      if (!setupIntent || !setupIntent.payment_method) {
        throw new Error('Failed to setup payment method');
      }

      // Step 3: Set as default payment method
      const setDefaultResponse = await fetch('/api/stripe/payment-methods/set-default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId,
          payment_method_id: setupIntent.payment_method as string,
        }),
      });

      const setDefaultData = await setDefaultResponse.json();

      if (setDefaultData.error) {
        throw new Error(setDefaultData.error);
      }

      toast({
        title: 'Success',
        description: 'Payment method updated successfully',
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update payment method',
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatCardBrand = (brand: string) => {
    return brand.charAt(0).toUpperCase() + brand.slice(1);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Update Payment Method</h2>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.content}>
            {loading ? (
              <div className={styles.loading}>Loading payment information...</div>
            ) : (
              <>
                {currentPaymentMethod && (
                  <div className={styles.currentMethod}>
                    <div className={styles.methodHeader}>
                      <CreditCard size={20} />
                      <span className={styles.methodLabel}>Current Payment Method</span>
                    </div>
                    <div className={styles.methodDetails}>
                      <span className={styles.cardInfo}>
                        {formatCardBrand(currentPaymentMethod.card.brand)} •••• {currentPaymentMethod.card.last4}
                      </span>
                      <span className={styles.cardExpiry}>
                        Expires {currentPaymentMethod.card.exp_month}/{currentPaymentMethod.card.exp_year}
                      </span>
                    </div>
                  </div>
                )}

                <div className={styles.newMethodSection}>
                  <label className={styles.label}>New Card Information</label>
                  <div className={styles.cardElementWrapper}>
                    <CardElement
                      options={{
                        style: {
                          base: {
                            fontSize: '16px',
                            color: '#1F1F1F',
                            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                            '::placeholder': {
                              color: '#8C7C6D',
                            },
                          },
                          invalid: {
                            color: '#991B1B',
                          },
                        },
                      }}
                    />
                  </div>
                  <p className={styles.secureNote}>
                    Your card information is securely processed by Stripe. We never store your full card details.
                  </p>
                </div>
              </>
            )}
          </div>

          <div className={styles.footer}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={submitting || !stripe || loading}
            >
              {submitting ? 'Updating...' : 'Update Payment Method'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UpdatePaymentModal(props: Props) {
  return (
    <Elements stripe={stripePromise}>
      <UpdatePaymentForm {...props} />
    </Elements>
  );
}
