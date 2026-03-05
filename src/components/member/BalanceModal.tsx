'use client';

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
import { Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberId?: string;
  accountId?: string;
}

export default function BalanceModal({ isOpen, onClose, memberId, accountId }: BalanceModalProps) {
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchTransactions();
    }
  }, [isOpen]);

  const fetchTransactions = async () => {
    try {
      setLoadingTransactions(true);
      const response = await fetch('/api/member/transactions', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load transactions',
        variant: 'error',
      });
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handlePayBalance = async () => {
    if (!accountId) return;

    setIsProcessingPayment(true);
    try {
      const response = await fetch('/api/chargeBalance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_id: accountId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to process payment');
      }

      toast({
        title: 'Payment Successful',
        description: 'Your balance has been paid successfully',
      });

      await fetchTransactions();
    } catch (error: any) {
      toast({
        title: 'Payment Failed',
        description: error.message,
        variant: 'error',
      });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleDownloadReceipt = () => {
    // Temporarily disabled PDF generation
    toast({
      title: 'Coming Soon',
      description: 'PDF receipt download will be available soon',
    });
  };

  const currentBalance = transactions.length > 0
    ? parseFloat(transactions[0].running_balance || 0)
    : 0;

  const formatAmount = (amount: number, type: string) => {
    const formatted = Math.abs(amount).toFixed(2);
    return type === 'credit' ? `+$${formatted}` : `-$${formatted}`;
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-[#1F1F1F]">
              Account Balance
            </DialogTitle>
            <DialogDescription className="text-sm text-[#5A5A5A] mt-1">
              View your current balance and transaction history
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6 pr-2">
            {/* Balance Summary */}
            <div className="bg-[#F6F5F2] rounded-xl p-3 border border-[#ECEAE5]">
              <div className="text-center">
                <p className="text-xs text-[#5A5A5A] mb-0.5">Current Balance</p>
                <p
                  className={`text-2xl font-bold ${
                    currentBalance >= 0 ? 'text-[#4CAF50]' : 'text-[#F44336]'
                  }`}
                >
                  ${Math.abs(currentBalance).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Transaction History */}
            <div>
              <h3 className="text-lg font-semibold text-[#1F1F1F] mb-4">Transaction History</h3>

              {loadingTransactions ? (
                <div className="flex justify-center py-12">
                  <Spinner className="text-[#A59480]" />
                </div>
              ) : transactions.length > 0 ? (
                <div className="space-y-2">
                  {transactions.map((transaction, index) => (
                    <div key={transaction.id || index}>
                      <div
                        className={`p-2 bg-white rounded-lg border border-[#ECEAE5] transition-colors ${
                          transaction.attachment_count > 0
                            ? 'cursor-pointer hover:bg-[#FBFBFA] hover:border-[#A59480]'
                            : ''
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (transaction.attachment_count > 0 && transaction.attachments && transaction.attachments.length > 0) {
                            setSelectedTransaction(transaction);
                          }
                        }}
                      >
                        {/* Row 1: Description and Amount */}
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-medium text-[#1F1F1F] truncate flex-1">
                            {transaction.description || 'Transaction'}
                          </p>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {transaction.attachment_count > 0 && (
                              <Download className="w-3 h-3 text-[#A59480]" />
                            )}
                            <p
                              className={`text-sm font-semibold ${
                                transaction.transaction_type === 'credit' ? 'text-[#4CAF50]' : 'text-[#F44336]'
                              }`}
                            >
                              {formatAmount(parseFloat(transaction.amount), transaction.transaction_type)}
                            </p>
                          </div>
                        </div>

                        {/* Row 2: Date and Running Balance */}
                        <div className="flex items-center justify-between gap-3 mt-1">
                          <p className="text-xs text-[#8C7C6D]">
                            {new Date(transaction.created_at).toLocaleDateString('en-US', {
                              month: 'numeric',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                          <p className="text-xs text-[#5A5A5A]">
                            Bal: ${parseFloat(transaction.running_balance || 0).toFixed(2)}
                          </p>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-[#5A5A5A]">No transactions yet</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Image Popup Modal - with event propagation stopped */}
      {selectedTransaction && selectedTransaction.attachments && selectedTransaction.attachments.length > 0 && (
        <Dialog open={!!selectedTransaction} onOpenChange={() => setSelectedTransaction(null)}>
          <DialogContent
            className="w-auto h-auto max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-0 overflow-auto"
            onPointerDownOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
            <DialogHeader className="sr-only">
              <DialogTitle>Transaction Receipt</DialogTitle>
              <DialogDescription>
                Receipt for {selectedTransaction.description || 'Transaction'} on{' '}
                {new Date(selectedTransaction.created_at).toLocaleDateString()}
              </DialogDescription>
            </DialogHeader>
            <div className="relative flex items-start justify-center min-h-full">
              {/* Close button - now fixed position */}
              <button
                onClick={() => setSelectedTransaction(null)}
                className="fixed top-4 right-4 z-20 w-12 h-12 flex items-center justify-center bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors"
                aria-label="Close receipt"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>

              {selectedTransaction.attachments.map((attachment: any, index: number) => {
                // Determine file type from file name or URL
                const fileName = attachment.file_name || attachment.file_url || '';
                const fileExt = fileName.split('.').pop()?.toLowerCase() || '';
                const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(fileExt);
                const isPDF = fileExt === 'pdf' || fileName.toLowerCase().includes('.pdf');

                return (
                <div key={attachment.id || index}>
                  {isImage ? (
                    <div className="relative">
                      {/* Download button overlay for images - now fixed position */}
                      <button
                        onClick={async () => {
                          try {
                            const response = await fetch(attachment.file_url);
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = attachment.file_name || `receipt-${selectedTransaction.id}.jpg`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            window.URL.revokeObjectURL(url);
                            toast({
                              title: 'Success',
                              description: 'Receipt downloaded successfully',
                            });
                          } catch (error) {
                            toast({
                              title: 'Download Failed',
                              description: 'Could not download the receipt',
                              variant: 'error',
                            });
                          }
                        }}
                        className="fixed top-4 left-4 z-10 bg-[#A59480] hover:bg-[#8C7C6D] text-white px-5 py-3 rounded-lg flex items-center gap-2 transition-all duration-200 hover:scale-105 shadow-lg"
                        aria-label="Download receipt"
                      >
                        <Download className="w-5 h-5" />
                        <span className="text-base font-medium">Download</span>
                      </button>

                      <img
                        src={attachment.file_url}
                        alt={attachment.file_name || 'Receipt'}
                        className="block max-w-[95vw] w-auto h-auto"
                      />
                    </div>
                  ) : isPDF ? (
                    <div className="bg-white p-4 rounded-lg flex flex-col" style={{ width: '90vw', height: '90vh' }}>
                      {/* Download button for PDFs */}
                      <div className="mb-4 flex justify-between items-center flex-shrink-0">
                        <h3 className="text-lg font-medium text-[#1F1F1F]">
                          {attachment.file_name || 'Receipt PDF'}
                        </h3>
                        <Button
                          onClick={async () => {
                            try {
                              const response = await fetch(attachment.file_url);
                              const blob = await response.blob();
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = attachment.file_name || `receipt-${selectedTransaction.id}.pdf`;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              window.URL.revokeObjectURL(url);
                              toast({
                                title: 'Success',
                                description: 'PDF downloaded successfully',
                              });
                            } catch (error) {
                              toast({
                                title: 'Download Failed',
                                description: 'Could not download the PDF',
                                variant: 'error',
                              });
                            }
                          }}
                          className="bg-[#A59480] text-white hover:bg-[#8C7C6D] flex items-center gap-2 px-5 py-3"
                        >
                          <Download className="w-5 h-5" />
                          Download PDF
                        </Button>
                      </div>
                      <iframe
                        src={attachment.file_url}
                        className="flex-1 w-full rounded border border-[#ECEAE5]"
                        title={attachment.file_name || 'Receipt PDF'}
                      />
                    </div>
                  ) : (
                    <div className="p-8 bg-white rounded-lg">
                      <p className="text-lg font-medium text-[#1F1F1F] mb-2">
                        {attachment.file_name || 'Document'}
                      </p>
                      <p className="text-sm text-[#8C7C6D] mb-6">
                        Cannot preview this file type
                      </p>
                      <Button
                        onClick={async () => {
                          try {
                            const response = await fetch(attachment.file_url);
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = attachment.file_name || `document-${selectedTransaction.id}`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            window.URL.revokeObjectURL(url);
                            toast({
                              title: 'Success',
                              description: 'File downloaded successfully',
                            });
                          } catch (error) {
                            toast({
                              title: 'Download Failed',
                              description: 'Could not download the file',
                              variant: 'error',
                            });
                          }
                        }}
                        className="bg-[#A59480] text-white hover:bg-[#8C7C6D] flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Download File
                      </Button>
                    </div>
                  )}
                </div>
              );
              })}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
