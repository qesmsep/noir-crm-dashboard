import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '@/hooks/useToast';
import { X, CreditCard, Building2 } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import styles from '../styles/UpdatePaymentModal.module.css';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface PaymentMethod {
  id: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
  us_bank_account?: {
    bank_name: string;
    last4: string;
    account_holder_type: string;
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

type PaymentType = 'card' | 'ach';

function UpdatePaymentForm({ accountId, onSuccess, onClose }: Props) {
  const { toast } = useToast();
  const stripe = useStripe();
  const elements = useElements();
  const [currentPaymentMethod, setCurrentPaymentMethod] = useState<PaymentMethod | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentType, setPaymentType] = useState<PaymentType>('card');

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

    if (!stripe) {
      return;
    }

    setSubmitting(true);

    try {
      if (paymentType === 'card') {
        await handleCardSubmit();
      } else {
        await handleAchSubmit();
      }
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

  const handleCardSubmit = async () => {
    if (!stripe || !elements) {
      throw new Error('Stripe not loaded');
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      throw new Error('Card element not found');
    }

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
      description: 'Card payment method updated successfully',
    });

    onSuccess();
  };

  const handleAchSubmit = async () => {
    if (!stripe) {
      throw new Error('Stripe not loaded');
    }

    // Reset scroll IMMEDIATELY before any Stripe API calls
    console.log('🔧 PRE-SETUP-INTENT scroll reset');
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    document.body.style.position = 'fixed';
    document.body.style.top = '0';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';

    console.log('🔧 After pre-setup scroll reset:', {
      bodyScrollTop: document.body.scrollTop,
      windowScrollY: window.scrollY
    });

    // Step 1: Create SetupIntent for ACH with Financial Connections
    const setupResponse = await fetch('/api/stripe/payment-methods/setup-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account_id: accountId,
        payment_method_type: 'us_bank_account',
      }),
    });

    const setupData = await setupResponse.json();

    if (setupData.error) {
      throw new Error(setupData.error);
    }

    // Close our modal temporarily so Stripe's Financial Connections modal can render cleanly
    onClose();

    // Wait for modal to close
    await new Promise(resolve => setTimeout(resolve, 300));

    // Body position was already locked before setup-intent, verify it's still locked
    console.log('AFTER modal close - verify scroll still locked:', {
      windowScrollY: window.scrollY,
      documentScrollTop: document.documentElement.scrollTop,
      bodyScrollTop: document.body.scrollTop,
      bodyPosition: document.body.style.position,
      bodyTop: document.body.style.top
    });

    // Watch for Stripe iframe insertion and fix positioning
    const observer = new MutationObserver(() => {
      const stripeIframe = document.querySelector('iframe[src*="stripe.com"], iframe[src*="js.stripe.com"]') as HTMLIFrameElement;
      if (stripeIframe) {
        console.log('🎯 STRIPE IFRAME DETECTED');

        // Try to fix the visual offset by adjusting the iframe position
        stripeIframe.style.position = 'fixed';
        stripeIframe.style.top = '0';
        stripeIframe.style.left = '0';
        stripeIframe.style.transform = 'none';
        stripeIframe.style.margin = '0';

        // Also fix any parent containers
        if (stripeIframe.parentElement) {
          stripeIframe.parentElement.style.transform = 'none';
          stripeIframe.parentElement.style.position = 'fixed';
          stripeIframe.parentElement.style.top = '0';
          stripeIframe.parentElement.style.left = '0';
        }

        console.log('🔧 Applied iframe position fixes');

        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    try {
      // Final check RIGHT before calling Stripe
      console.log('🚀 RIGHT BEFORE collectBankAccountForSetup:', {
        'window.scrollY': window.scrollY,
        'document.documentElement.scrollTop': document.documentElement.scrollTop,
        'document.body.scrollTop': document.body.scrollTop,
        'body.style.top': document.body.style.top,
        'computed body.top': window.getComputedStyle(document.body).top,
        'body.getBoundingClientRect().top': document.body.getBoundingClientRect().top,
        'window.innerHeight': window.innerHeight,
        'document.documentElement.clientHeight': document.documentElement.clientHeight
      });

      // Override ALL scroll properties Stripe might read
      Object.defineProperty(window, 'pageYOffset', { value: 0, configurable: true });
      Object.defineProperty(window, 'pageXOffset', { value: 0, configurable: true });
      Object.defineProperty(document.documentElement, 'scrollTop', { value: 0, configurable: true, writable: true });
      Object.defineProperty(document.body, 'scrollTop', { value: 0, configurable: true, writable: true });

      console.log('🔒 OVERRIDDEN scroll properties:', {
        'window.pageYOffset': window.pageYOffset,
        'window.pageXOffset': window.pageXOffset,
        'window.scrollY': window.scrollY,
        'window.scrollX': window.scrollX
      });

      // Force visual viewport alignment
      const viewport = document.querySelector('meta[name="viewport"]');
      console.log('📱 Viewport meta:', viewport?.getAttribute('content'));

      // Temporarily set viewport to prevent zooming/scaling issues
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
      }

      // Force the HTML and body to have no margins/padding that might offset content
      document.documentElement.style.margin = '0';
      document.documentElement.style.padding = '0';
      document.body.style.margin = '0';
      document.body.style.padding = '0';

      // Force a reflow to ensure styles are applied
      void document.body.offsetHeight;

      // Dispatch resize event
      window.dispatchEvent(new Event('resize'));
      await new Promise(resolve => setTimeout(resolve, 100));

      // Step 2: Collect bank account - Financial Connections will auto-launch
      const { setupIntent, error: stripeError } = await stripe.collectBankAccountForSetup({
        clientSecret: setupData.client_secret,
        params: {
          payment_method_type: 'us_bank_account',
          payment_method_data: {
            billing_details: {
              name: 'Account Holder',
            },
          },
        },
      });

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      if (!setupIntent || !setupIntent.payment_method) {
        throw new Error('Failed to setup bank account');
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
        description: 'Bank account verified and added successfully!',
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add bank account',
        variant: 'error',
      });
    } finally {
      // Unlock body scroll after Stripe flow completes
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      document.body.style.height = '';
    }
  };

  const formatCardBrand = (brand: string) => {
    return brand.charAt(0).toUpperCase() + brand.slice(1);
  };

  // Render modal at document.body level to avoid coordinate issues
  const modalContent = (
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
                      {currentPaymentMethod.type === 'card' ? (
                        <CreditCard size={20} />
                      ) : (
                        <Building2 size={20} />
                      )}
                      <span className={styles.methodLabel}>Current Payment Method</span>
                    </div>
                    <div className={styles.methodDetails}>
                      {currentPaymentMethod.card && (
                        <>
                          <span className={styles.cardInfo}>
                            {formatCardBrand(currentPaymentMethod.card.brand)} •••• {currentPaymentMethod.card.last4}
                          </span>
                          <span className={styles.cardExpiry}>
                            Expires {currentPaymentMethod.card.exp_month}/{currentPaymentMethod.card.exp_year}
                          </span>
                        </>
                      )}
                      {currentPaymentMethod.us_bank_account && (
                        <span className={styles.cardInfo}>
                          {currentPaymentMethod.us_bank_account.bank_name} •••• {currentPaymentMethod.us_bank_account.last4}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Payment Type Selector */}
                <div className={styles.paymentTypeSelector}>
                  <button
                    type="button"
                    className={`${styles.typeButton} ${paymentType === 'card' ? styles.typeButtonActive : ''}`}
                    onClick={() => setPaymentType('card')}
                  >
                    <CreditCard size={18} />
                    Credit/Debit Card
                  </button>
                  <button
                    type="button"
                    className={`${styles.typeButton} ${paymentType === 'ach' ? styles.typeButtonActive : ''}`}
                    onClick={() => {
                      console.log('🏦 ACH payment type selected');
                      console.log('🏦 Scroll at ACH selection:', {
                        windowScrollY: window.scrollY,
                        documentScrollTop: document.documentElement.scrollTop,
                        bodyScrollTop: document.body.scrollTop
                      });
                      setPaymentType('ach');
                    }}
                  >
                    <Building2 size={18} />
                    Bank Account (ACH)
                  </button>
                </div>

                {/* Card Form */}
                {paymentType === 'card' && (
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
                )}

                {/* ACH Instant Verification */}
                {paymentType === 'ach' && (
                  <div className={styles.newMethodSection}>
                    <div className={styles.achInstantVerification}>
                      <h3 className={styles.achTitle}>Instant Bank Verification</h3>
                      <p className={styles.achDescription}>
                        Click "Add Bank Account" below to securely connect your bank account through Stripe's instant verification.
                      </p>
                      <ul className={styles.achBenefits}>
                        <li>🔒 Secure connection through your bank</li>
                        <li>⚡ Instant verification - no waiting for deposits</li>
                        <li>✓ Ready to use immediately</li>
                      </ul>
                      <p className={styles.achNote}>
                        You'll be prompted to log into your bank to verify your account securely.
                      </p>
                    </div>
                  </div>
                )}
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
              {submitting ? 'Processing...' : paymentType === 'card' ? 'Update Card' : 'Add Bank Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // Use portal to render at document.body level (avoid parent modal coordinate issues)
  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : null;
}

export default function UpdatePaymentModal(props: Props) {
  return (
    <Elements stripe={stripePromise}>
      <UpdatePaymentForm {...props} />
    </Elements>
  );
}
