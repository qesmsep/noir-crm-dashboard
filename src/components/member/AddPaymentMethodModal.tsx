"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPortal,
  DialogOverlay,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/useToast';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { CreditCard } from 'lucide-react';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface AddPaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  onSuccess: () => void;
  initialPaymentType?: 'card' | 'us_bank_account' | null;
}

// Payment Form Component
function PaymentForm({ accountId, onSuccess, onCancel, modalRef, paymentType, clientSecret }: { accountId: string; onSuccess: () => void; onCancel: () => void; modalRef?: React.RefObject<HTMLDivElement>; paymentType?: 'card' | 'us_bank_account'; clientSecret?: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setSubmitting(true);

    try {
      let setupIntent;

      if (paymentType === 'card') {
        // CardElement flow
        const cardElement = elements.getElement(CardElement);
        if (!cardElement) {
          throw new Error('Card element not found');
        }

        const { error: confirmError, setupIntent: si } = await stripe.confirmCardSetup(
          clientSecret!,
          {
            payment_method: {
              card: cardElement,
            },
          }
        );

        if (confirmError) {
          throw new Error(confirmError.message);
        }

        setupIntent = si;
      } else {
        // PaymentElement flow (for bank accounts)
        const { error: submitError } = await elements.submit();

        if (submitError) {
          throw new Error(submitError.message);
        }

        const { error: confirmError, setupIntent: si } = await stripe.confirmSetup({
          elements,
          redirect: 'if_required',
          confirmParams: {
            return_url: window.location.href,
          },
        });

        if (confirmError) {
          throw new Error(confirmError.message);
        }

        setupIntent = si;
      }

      if (!setupIntent || !setupIntent.payment_method) {
        throw new Error('Failed to setup payment method');
      }

      // Step 3: Set as default payment method
      const setDefaultResponse = await fetch('/api/stripe/payment-methods/set-default', {
        method: 'PUT',
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
        description: 'Payment method added successfully',
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add payment method',
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {paymentType === 'card' ? (
        /* Use simple CardElement for cards - no iframe issues */
        <div>
          <label className="block text-sm font-medium text-[#1F1F1F] mb-2">
            Card Information
          </label>
          <div className="border border-[#ECEAE5] rounded-lg p-3">
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#1F1F1F',
                    '::placeholder': {
                      color: '#8C7C6D',
                    },
                  },
                },
              }}
            />
          </div>
        </div>
      ) : (
        /* Use PaymentElement for bank accounts */
        <PaymentElement />
      )}
      <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={submitting}
          className="border-[#ECEAE5] text-[#5A5A5A] hover:bg-[#F6F5F2]"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!stripe || submitting}
          className="bg-[#A59480] text-white hover:bg-[#8C7C6D]"
        >
          {submitting ? 'Adding...' : 'Add Payment Method'}
        </Button>
      </div>
    </form>
  );
}

// Main Modal Component
function AddPaymentMethodModalContent({ isOpen, onClose, accountId, onSuccess, initialPaymentType }: AddPaymentMethodModalProps) {
  const { toast } = useToast();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentType, setPaymentType] = useState<'card' | 'us_bank_account' | null>(initialPaymentType || null);
  const dialogRef = React.useRef<HTMLDivElement>(null);

  // Update paymentType when initialPaymentType changes
  useEffect(() => {
    if (initialPaymentType) {
      setPaymentType(initialPaymentType);
    }
  }, [initialPaymentType]);

  useEffect(() => {
    if (isOpen && accountId && paymentType) {
      fetchSetupIntent();
    }
  }, [isOpen, accountId, paymentType]);

  // Lock body scroll when modal opens
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';

      return () => {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  const fetchSetupIntent = async () => {
    try {
      const response = await fetch('/api/stripe/payment-methods/setup-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId,
          payment_method_type: paymentType || 'card'
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setClientSecret(data.client_secret);
    } catch (error: any) {
      console.error('Setup intent error:', error);
      toast({
        title: 'Error',
        description: 'Failed to initialize payment form',
        variant: 'error',
      });
      onClose();
    }
  };

  const handleSuccess = () => {
    setClientSecret(null);
    onSuccess();
    onClose();
  };

  const handleCancel = () => {
    setClientSecret(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Custom Overlay */}
      <div
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Custom Dialog Content - CENTERED */}
      <div
        ref={dialogRef}
        className="fixed z-[61] bg-white rounded-2xl shadow-2xl border border-[#ECEAE5] p-6"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          marginTop: '-150px',
          marginLeft: '-175px',
          width: '350px',
          maxWidth: '90vw',
          maxHeight: '90vh',
          overflow: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 opacity-70 transition-opacity hover:opacity-100 hover:bg-[#F6F5F2] focus:outline-none z-10"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content */}
        <div>
          {!paymentType ? (
            /* Step 1: Choose payment type */
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-[#1F1F1F] mb-4">Choose Payment Method</h2>

              <button
                onClick={() => setPaymentType('card')}
                className="w-full p-6 border-2 border-[#ECEAE5] rounded-xl hover:border-[#A59480] hover:bg-[#FBFBFA] transition-all text-left"
              >
                <div className="flex items-center gap-4">
                  <CreditCard className="w-8 h-8 text-[#A59480]" />
                  <div>
                    <p className="text-lg font-semibold text-[#1F1F1F]">Credit or Debit Card</p>
                    <p className="text-sm text-[#5A5A5A]">Visa, Mastercard, Amex, Discover</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setPaymentType('us_bank_account')}
                className="w-full p-6 border-2 border-[#ECEAE5] rounded-xl hover:border-[#A59480] hover:bg-[#FBFBFA] transition-all text-left"
              >
                <div className="flex items-center gap-4">
                  <svg className="w-8 h-8 text-[#A59480]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  <div>
                    <p className="text-lg font-semibold text-[#1F1F1F]">US Bank Account</p>
                    <p className="text-sm text-[#5A5A5A]">ACH Direct Debit</p>
                  </div>
                </div>
              </button>

              <Button
                onClick={onClose}
                variant="outline"
                className="w-full border-[#ECEAE5] text-[#5A5A5A] hover:bg-[#F6F5F2]"
              >
                Cancel
              </Button>
            </div>
          ) : !clientSecret ? (
            /* Step 2a: Loading Stripe */
            <div className="flex justify-center py-12">
              <Spinner className="text-[#A59480]" />
            </div>
          ) : (
            /* Step 2b: Show Stripe form */
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'stripe',
                  variables: {
                    colorPrimary: '#A59480',
                    colorBackground: '#FFFFFF',
                    colorText: '#1F1F1F',
                    colorDanger: '#F44336',
                    fontFamily: 'system-ui, sans-serif',
                    borderRadius: '8px',
                  },
                },
              }}
            >
              <PaymentForm
                accountId={accountId}
                onSuccess={handleSuccess}
                onCancel={handleCancel}
                modalRef={dialogRef}
                paymentType={paymentType}
                clientSecret={clientSecret}
              />
            </Elements>
          )}
        </div>
      </div>
    </>
  );
}

export default function AddPaymentMethodModal(props: AddPaymentMethodModalProps) {
  return <AddPaymentMethodModalContent {...props} />;
}
