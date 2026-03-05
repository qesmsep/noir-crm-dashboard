"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/useToast';
import { CreditCard, Trash2 } from 'lucide-react';
import UpdatePaymentModal from '../UpdatePaymentModal';

interface PaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId?: string;
}

function PaymentMethodModalContent({ isOpen, onClose, accountId }: PaymentMethodModalProps) {
  const { toast } = useToast();
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpdatePaymentModal, setShowUpdatePaymentModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [paymentMethodToDelete, setPaymentMethodToDelete] = useState<any | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && accountId) {
      fetchPaymentMethods();
    }
  }, [isOpen, accountId]);

  // Lock body scroll when modal opens to prevent body.scrollTop from accumulating
  useEffect(() => {
    if (isOpen) {
      console.log('🔒 PaymentMethodModal: Locking body scroll');
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';

      return () => {
        console.log('🔓 PaymentMethodModal: Unlocking body scroll');
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  const fetchPaymentMethods = async () => {
    try {
      const response = await fetch(`/api/stripe/payment-methods/list?account_id=${accountId}`);
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      console.log('Payment methods data:', data);

      // Map payment methods and add is_default flag
      const methodsWithDefault = (data.payment_methods || []).map((method: any) => ({
        ...method,
        is_default: method.id === data.default_payment_method,
      }));

      console.log('Mapped payment methods:', methodsWithDefault);

      setPaymentMethods(methodsWithDefault);
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
    setSettingDefaultId(paymentMethodId);
    try {
      console.log('Setting default payment method:', paymentMethodId);

      const response = await fetch('/api/stripe/payment-methods/set-default', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId,
          payment_method_id: paymentMethodId,
        }),
      });

      const data = await response.json();
      console.log('Set default response:', data);

      if (data.error) {
        throw new Error(data.error);
      }

      // Wait a moment for Stripe to sync before refreshing
      await new Promise(resolve => setTimeout(resolve, 500));

      await fetchPaymentMethods();

      toast({
        title: 'Success',
        description: 'Default payment method updated',
      });
    } catch (error: any) {
      console.error('Set default error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update payment method',
        variant: 'error',
      });
    } finally {
      setSettingDefaultId(null);
    }
  };

  const handleDelete = async () => {
    if (!paymentMethodToDelete) return;

    setDeletingId(paymentMethodToDelete.id);
    try {
      const response = await fetch('/api/stripe/payment-methods/detach', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_method_id: paymentMethodToDelete.id,
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
      setPaymentMethodToDelete(null);
    }
  };

  return (
    <>
    <Dialog open={isOpen && !paymentMethodToDelete && !showUpdatePaymentModal} onOpenChange={onClose}>
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
                        className={`bg-white rounded-xl p-4 border ${
                          method.is_default ? 'border-[#4CAF50]' : 'border-[#ECEAE5]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <CreditCard className="w-5 h-5 text-[#A59480] flex-shrink-0" />
                            <div className="min-w-0">
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

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {method.is_default ? (
                              <Badge className="bg-[#4CAF50] text-[#1F1F1F] text-xs font-bold">Default</Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSetDefault(method.id)}
                                disabled={settingDefaultId !== null}
                                className="border-[#ECEAE5] text-[#5A5A5A] hover:bg-[#F6F5F2] text-xs disabled:opacity-50 min-w-[90px]"
                              >
                                {settingDefaultId === method.id ? '...' : 'Set Default'}
                              </Button>
                            )}
                            {paymentMethods.length > 1 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (method.is_default) {
                                    toast({
                                      title: 'Cannot Delete Default Payment Method',
                                      description: 'Please set another payment method as default before deleting this one.',
                                      variant: 'error',
                                    });
                                    return;
                                  }
                                  setPaymentMethodToDelete(method);
                                }}
                                disabled={deletingId === method.id}
                                className={`p-2 transition-colors ${
                                  method.is_default
                                    ? 'text-gray-400 cursor-not-allowed opacity-50'
                                    : 'text-red-500 hover:bg-red-50'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
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
              <div>
                <Button
                  onClick={() => {
                    console.log('🔘 UPDATE PAYMENT METHOD BUTTON CLICKED');
                    console.log('🔘 Scroll state:', {
                      windowScrollY: window.scrollY,
                      documentScrollTop: document.documentElement.scrollTop,
                      bodyScrollTop: document.body.scrollTop,
                      bodyPosition: document.body.style.position,
                      bodyTop: document.body.style.top
                    });
                    setShowUpdatePaymentModal(true);
                  }}
                  className="w-full bg-[#A59480] text-white hover:bg-[#8C7C6D]"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Update Payment Method
                </Button>
              </div>

              {/* Billing Information */}
              <div className="bg-[#F6F5F2] rounded-xl p-6 border border-[#ECEAE5] relative z-0">
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

    {/* Delete Confirmation Dialog */}
    <AlertDialog open={!!paymentMethodToDelete} onOpenChange={() => setPaymentMethodToDelete(null)}>
      <AlertDialogContent className="bg-white">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Payment Method?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove{' '}
            {paymentMethodToDelete && (
              <>
                {paymentMethodToDelete.type === 'card' ? (
                  <>
                    {paymentMethodToDelete.card?.brand?.toUpperCase()} ending in {paymentMethodToDelete.card?.last4}
                  </>
                ) : (
                  <>
                    {paymentMethodToDelete.us_bank_account?.bank_name} ending in {paymentMethodToDelete.us_bank_account?.last4}
                  </>
                )}
              </>
            )}
            ? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-[#F44336] text-white hover:bg-[#D32F2F]"
            disabled={!!deletingId}
          >
            {deletingId ? 'Deleting...' : 'Delete Payment Method'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Update Payment Method Modal */}
    {accountId && showUpdatePaymentModal && (
      <UpdatePaymentModal
        accountId={accountId}
        onSuccess={() => {
          setShowUpdatePaymentModal(false);
          fetchPaymentMethods();
        }}
        onClose={() => setShowUpdatePaymentModal(false)}
      />
    )}
  </>
  );
}

export default function PaymentMethodModal(props: PaymentMethodModalProps) {
  return <PaymentMethodModalContent {...props} />;
}