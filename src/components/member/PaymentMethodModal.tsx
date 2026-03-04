"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/useToast';
import { CreditCard, Plus, Trash2, Check, Building2 } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface PaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId?: string;
}

// Add Card Form Component
function AddCardForm({ accountId, onSuccess, onCancel }: { accountId: string; onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-[#F6F5F2] p-4 rounded-lg border border-[#ECEAE5]">
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
      <div className="flex gap-3 justify-end">
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
          {submitting ? 'Adding...' : 'Add Card'}
        </Button>
      </div>
    </form>
  );
}

function PaymentMethodModalContent({ isOpen, onClose, accountId }: PaymentMethodModalProps) {
  const { toast } = useToast();
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCard, setShowAddCard] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && accountId) {
      fetchPaymentMethods();
    }
  }, [isOpen, accountId]);

  const fetchPaymentMethods = async () => {
    try {
      const response = await fetch(`/api/stripe/payment-methods/list?account_id=${accountId}`);
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setPaymentMethods(data.payment_methods || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load payment methods',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (paymentMethodId: string) => {
    try {
      const response = await fetch('/api/stripe/payment-methods/set-default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId,
          payment_method_id: paymentMethodId,
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Success',
        description: 'Default payment method updated',
      });

      fetchPaymentMethods();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update payment method',
        variant: 'error',
      });
    }
  };

  const handleDelete = async (paymentMethodId: string) => {
    setDeletingId(paymentMethodId);
    try {
      const response = await fetch('/api/stripe/payment-methods/detach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_method_id: paymentMethodId,
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Success',
        description: 'Payment method removed',
      });

      fetchPaymentMethods();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove payment method',
        variant: 'error',
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-[#1F1F1F]">
            Payment Methods
          </DialogTitle>
          <DialogDescription className="text-sm text-[#5A5A5A] mt-1">
            Manage your payment methods and billing preferences
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner className="text-[#A59480]" />
            </div>
          ) : (
            <>
              {/* Payment Methods List - Simplified */}
              <div className="space-y-4">
                {paymentMethods.length > 0 ? (
                  <div className="space-y-3">
                    {paymentMethods.map((method) => (
                      <div
                        key={method.id}
                        className={`bg-white rounded-xl p-4 border-2 ${
                          method.is_default ? 'border-[#A59480]' : 'border-[#ECEAE5]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <CreditCard className="w-5 h-5 text-[#A59480]" />
                            <div>
                              <p className="font-medium text-[#1F1F1F]">
                                {method.type === 'card' ? (
                                  <>•••• {method.card?.last4}</>
                                ) : (
                                  <>•••• {method.us_bank_account?.last4}</>
                                )}
                              </p>
                              <p className="text-xs text-[#5A5A5A]">
                                {method.type === 'card' ? (
                                  <>
                                    {method.card?.brand?.toUpperCase()} • Exp {method.card?.exp_month}/{method.card?.exp_year}
                                  </>
                                ) : (
                                  <>{method.us_bank_account?.bank_name}</>
                                )}
                              </p>
                            </div>
                          </div>
                          {method.is_default && (
                            <Badge className="bg-[#4CAF50] text-white text-xs">Default</Badge>
                          )}
                        </div>

                        <div className="flex gap-2 mt-3">
                          {!method.is_default && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSetDefault(method.id)}
                              className="flex-1 border-[#ECEAE5] text-[#5A5A5A] hover:bg-[#F6F5F2]"
                            >
                              Set as Default
                            </Button>
                          )}
                          {paymentMethods.length > 1 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(method.id)}
                              disabled={deletingId === method.id || method.is_default}
                              className="text-red-500 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              title={method.is_default ? "Cannot delete default payment method" : "Delete payment method"}
                            >
                              {deletingId === method.id ? (
                                <Spinner className="w-4 h-4" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <CreditCard className="w-12 h-12 text-[#8C7C6D] mx-auto mb-4" />
                    <p className="text-[#5A5A5A] mb-2">No payment methods on file</p>
                    <p className="text-sm text-[#8C7C6D]">Click below to update your payment method</p>
                  </div>
                )}
              </div>

              {/* Update Payment Method Section */}
              {showAddCard ? (
                <div className="bg-white rounded-xl p-6 border-2 border-[#A59480]">
                  <h3 className="text-lg font-semibold text-[#1F1F1F] mb-4">Update Payment Method</h3>
                  <p className="text-sm text-[#5A5A5A] mb-4">Enter your new payment information below</p>
                  <AddCardForm
                    accountId={accountId!}
                    onSuccess={() => {
                      setShowAddCard(false);
                      fetchPaymentMethods();
                    }}
                    onCancel={() => setShowAddCard(false)}
                  />
                </div>
              ) : (
                <Button
                  onClick={() => setShowAddCard(true)}
                  className="w-full bg-[#A59480] text-white hover:bg-[#8C7C6D]"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Update Payment Method
                </Button>
              )}

              {/* Billing Information */}
              <div className="bg-[#F6F5F2] rounded-xl p-6 border border-[#ECEAE5]">
                <h3 className="text-lg font-semibold text-[#1F1F1F] mb-4">Billing Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-[#5A5A5A]">Next Billing Date</p>
                    <p className="text-[#1F1F1F] font-medium">
                      {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-[#5A5A5A]">Billing Cycle</p>
                    <p className="text-[#1F1F1F] font-medium">Monthly</p>
                  </div>
                  <div>
                    <p className="text-sm text-[#5A5A5A]">Last Payment</p>
                    <p className="text-[#1F1F1F] font-medium">$99.00</p>
                  </div>
                  <div>
                    <p className="text-sm text-[#5A5A5A]">Payment Status</p>
                    <Badge className="bg-[#4CAF50] text-white">Current</Badge>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PaymentMethodModal(props: PaymentMethodModalProps) {
  return (
    <Elements stripe={stripePromise}>
      <PaymentMethodModalContent {...props} />
    </Elements>
  );
}