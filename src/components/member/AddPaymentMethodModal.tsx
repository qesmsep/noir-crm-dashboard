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
        /* Use PaymentElement for bank accounts - ACH has click issues, warn user */
        <div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> If you have trouble clicking options below, try scrolling the page to the top first.
            </p>
          </div>
          <PaymentElement
            onChange={(event) => {
              console.log('Payment method changed:', event);
            }}
            onReady={() => {
            console.log('=== STRIPE ACH DEBUG ===');
            console.log('Body scroll:', document.body.scrollTop);

          const iframe = document.querySelector('iframe[name^="__privateStripeFrame"]') as HTMLIFrameElement;
          if (iframe) {
            // NUCLEAR OPTION: Manually inject CSS into Stripe's iframe to offset button positions
            try {
              const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
              if (iframeDoc) {
                const style = iframeDoc.createElement('style');
                style.textContent = `
                  * {
                    transform: translateY(-100px) !important;
                  }
                `;
                iframeDoc.head.appendChild(style);
                console.log('✓ Injected offset correction into Stripe iframe');
              }
            } catch (e) {
              console.log('Cannot inject into Stripe iframe (cross-origin):', e);
            }

            const rect = iframe.getBoundingClientRect();
            console.log('Iframe position AFTER reflow:', {
              x: rect.x,
              y: rect.y,
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height
            });

            // Calculate where "Card" button is
            const iframeRect = iframe.getBoundingClientRect();
            const cardButtonTop = iframeRect.top + 40; // Where Card button should be
            const cardButtonLeft = iframeRect.left + 100;

            // Add TWO markers: one red for visual Card position, one green for where click lands
            const redMarker = document.createElement('div');
            redMarker.style.position = 'fixed';
            redMarker.style.left = cardButtonLeft + 'px';
            redMarker.style.top = cardButtonTop + 'px';
            redMarker.style.width = '15px';
            redMarker.style.height = '15px';
            redMarker.style.borderRadius = '50%';
            redMarker.style.backgroundColor = 'red';
            redMarker.style.zIndex = '99999';
            redMarker.style.pointerEvents = 'none';
            redMarker.textContent = 'C';
            redMarker.style.color = 'white';
            redMarker.style.fontSize = '10px';
            redMarker.style.textAlign = 'center';
            document.body.appendChild(redMarker);
            console.log('RED MARKER (C) = Visual Card button position:', cardButtonLeft, cardButtonTop);

            // Add click listener to show where clicks actually land
            let clickCount = 0;
            if (modalRef?.current) {
              modalRef.current.addEventListener('click', (e) => {
                clickCount++;

                // Show green dot where click landed
                const greenDot = document.createElement('div');
                greenDot.style.position = 'fixed';
                greenDot.style.left = e.clientX + 'px';
                greenDot.style.top = e.clientY + 'px';
                greenDot.style.width = '10px';
                greenDot.style.height = '10px';
                greenDot.style.borderRadius = '50%';
                greenDot.style.backgroundColor = 'lime';
                greenDot.style.border = '2px solid green';
                greenDot.style.zIndex = '99999';
                greenDot.style.pointerEvents = 'none';
                document.body.appendChild(greenDot);
                setTimeout(() => greenDot.remove(), 3000);

                console.log('CLICK #' + clickCount + ':', {
                  clickAt: { x: e.clientX, y: e.clientY },
                  cardButtonVisualPos: { x: cardButtonLeft, y: cardButtonTop },
                  offsetFromCard: {
                    x: e.clientX - cardButtonLeft,
                    y: e.clientY - cardButtonTop
                  }
                });
              }, true);
            }

            // Add click listener to detect actual click position
            iframe.addEventListener('click', (e) => {
              const iframeRect = iframe.getBoundingClientRect();
              console.log('CLICK on iframe:', {
                clientX: e.clientX,
                clientY: e.clientY,
                pageX: e.pageX,
                pageY: e.pageY,
                offsetX: e.offsetX,
                offsetY: e.offsetY,
                iframeRect: {
                  x: iframeRect.x,
                  y: iframeRect.y,
                  top: iframeRect.top,
                  left: iframeRect.left
                }
              });

              // Draw a red dot where the click was registered
              const dot = document.createElement('div');
              dot.style.position = 'fixed';
              dot.style.left = e.clientX + 'px';
              dot.style.top = e.clientY + 'px';
              dot.style.width = '10px';
              dot.style.height = '10px';
              dot.style.borderRadius = '50%';
              dot.style.backgroundColor = 'red';
              dot.style.zIndex = '99999';
              dot.style.pointerEvents = 'none';
              document.body.appendChild(dot);
              setTimeout(() => dot.remove(), 2000);
            }, true);
          }
        }}
        />
        </div>
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
  const [scrollLocked, setScrollLocked] = useState(false);
  const [paymentType, setPaymentType] = useState<'card' | 'us_bank_account' | null>(initialPaymentType || null);
  const dialogRef = React.useRef<HTMLDivElement>(null);

  // Update paymentType when initialPaymentType changes
  useEffect(() => {
    if (initialPaymentType) {
      setPaymentType(initialPaymentType);
    }
  }, [initialPaymentType]);

  useEffect(() => {
    if (dialogRef.current && clientSecret) {
      const element = dialogRef.current;
      const computed = window.getComputedStyle(element);
      console.log('Dialog Debug:', {
        transform: computed.transform,
        translate: computed.translate,
        position: computed.position,
        top: computed.top,
        left: computed.left,
        zIndex: computed.zIndex,
        boundingRect: element.getBoundingClientRect()
      });

      // Check all parent transforms
      let parent = element.parentElement;
      let level = 0;
      while (parent && level < 5) {
        const parentComputed = window.getComputedStyle(parent);
        if (parentComputed.transform !== 'none') {
          console.log(`Parent ${level} transform:`, parentComputed.transform, parent);
        }
        parent = parent.parentElement;
        level++;
      }
    }
  }, [clientSecret, dialogRef.current]);

  useEffect(() => {
    if (isOpen && accountId && scrollLocked && paymentType) {
      fetchSetupIntent();
    }
  }, [isOpen, accountId, scrollLocked, paymentType]);

  // Lock body scroll when modal opens - force body scrollTop to 0
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      const bodyScrollTop = document.body.scrollTop;

      // Force body scroll to 0
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
      window.scrollTo(0, 0);

      // Lock scroll
      document.body.style.position = 'fixed';
      document.body.style.top = '0';
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';

      // Poll until body scroll is ACTUALLY 0, then allow Stripe to load
      const checkScroll = () => {
        const currentBodyScroll = document.body.scrollTop;
        console.log('Checking body.scrollTop:', currentBodyScroll);
        if (currentBodyScroll === 0) {
          console.log('✓ Body scroll is 0, loading Stripe...');
          setScrollLocked(true);
        } else {
          console.log('✗ Body scroll still not 0, forcing again...');
          document.body.scrollTop = 0;
          document.documentElement.scrollTop = 0;
          setTimeout(checkScroll, 50);
        }
      };
      setTimeout(checkScroll, 50);

      return () => {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
        document.body.scrollTop = bodyScrollTop;
        setScrollLocked(false);
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
