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
import { CreditCard, Users, Plus } from 'lucide-react';
import { useMemberAuth } from '@/context/MemberAuthContext';
import UpdatePaymentModal from '../UpdatePaymentModal';
import AddSecondaryMemberModal from '../AddSecondaryMemberModal';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId?: string;
}

function SubscriptionModalContent({ isOpen, onClose, accountId }: SubscriptionModalProps) {
  const { toast } = useToast();
  const { member } = useMemberAuth();
  const [loading, setLoading] = useState(true);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [accountMembers, setAccountMembers] = useState<any[]>([]);
  const [currentPaymentMethod, setCurrentPaymentMethod] = useState<any>(null);
  const [showUpdatePaymentModal, setShowUpdatePaymentModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [updatingPayment, setUpdatingPayment] = useState(false);
  const [copiedReferralLink, setCopiedReferralLink] = useState(false);

  useEffect(() => {
    if (isOpen && accountId) {
      fetchAllData();
    }
  }, [isOpen, accountId]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchSubscriptionData(),
      fetchAccountMembers(),
      fetchCurrentPaymentMethod(),
    ]);
    setLoading(false);
  };

  const fetchSubscriptionData = async () => {
    try {
      const response = await fetch('/api/member/account-subscription', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setSubscriptionData({
          ...data.subscription,
          baseMRR: data.baseMRR,
          secondaryMemberCount: data.secondaryMemberCount,
        });
      }
    } catch (error) {
      console.error('Error fetching subscription data:', error);
    }
  };

  const fetchAccountMembers = async () => {
    try {
      const response = await fetch('/api/member/account-members', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setAccountMembers(data.members || []);
      }
    } catch (error) {
      console.error('Error fetching account members:', error);
    }
  };

  const fetchCurrentPaymentMethod = async () => {
    try {
      const response = await fetch(`/api/stripe/payment-methods/list?account_id=${accountId}`);
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Get the default/current payment method
      const defaultMethod = (data.payment_methods || []).find(
        (method: any) => method.id === data.default_payment_method
      );

      setCurrentPaymentMethod(defaultMethod || null);
    } catch (error) {
      console.error('Error fetching payment method:', error);
    }
  };

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

  const handleCopyReferralLink = async () => {
    if (!member?.referral_code) return;

    const referralLink = `https://noirkc.com/refer/${member.referral_code}`;

    try {
      await navigator.clipboard.writeText(referralLink);
      setCopiedReferralLink(true);
      setTimeout(() => setCopiedReferralLink(false), 2000);
    } catch (err) {
      console.error('Failed to copy referral link:', err);
    }
  };

  const baseMRR = subscriptionData?.baseMRR || 0;
  const secondaryMemberCount = subscriptionData?.secondaryMemberCount || 0;
  const additionalMemberFee = subscriptionData?.additionalMemberFee || 0; // $0 for Skyline, $25 for Solo/Duo
  const additionalMemberFees = secondaryMemberCount * additionalMemberFee;
  const total = baseMRR + additionalMemberFees;

  return (
    <>
      <Dialog open={isOpen && !showUpdatePaymentModal && !showAddMemberModal} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-[#1F1F1F]">
              Membership & Members
            </DialogTitle>
            <DialogDescription className="text-sm text-[#5A5A5A] mt-1">
              Manage your membership, members, and payment methods
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6 pr-2">
            {loading ? (
              <div className="flex justify-center py-12">
                <Spinner className="text-[#A59480]" />
              </div>
            ) : (
              <>
                {/* Membership Overview */}
                <div className="bg-[#F6F5F2] rounded-xl p-4 border border-[#ECEAE5]">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-semibold text-[#1F1F1F]">Membership</h3>
                    <Badge className={`text-white text-xs ${
                      subscriptionData?.subscription_status === 'active' ? 'bg-[#4CAF50]' :
                      subscriptionData?.subscription_status === 'past_due' ? 'bg-[#FF9800]' :
                      subscriptionData?.subscription_status === 'canceled' ? 'bg-[#F44336]' :
                      'bg-[#4CAF50]'
                    }`}>
                      {subscriptionData?.subscription_status?.toUpperCase() || 'ACTIVE'}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#8C7C6D]">Base Membership</span>
                      <span className="text-xs font-medium text-[#1F1F1F]">{formatCurrency(baseMRR)}/mo</span>
                    </div>

                    {secondaryMemberCount > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#8C7C6D]">
                          Additional Members ({secondaryMemberCount} × ${additionalMemberFee.toFixed(0)})
                        </span>
                        <span className="text-xs font-medium text-[#1F1F1F]">{formatCurrency(additionalMemberFees)}/mo</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-[#E8E6E1]">
                      <span className="text-sm font-semibold text-[#1F1F1F]">Total</span>
                      <span className="text-base font-bold text-[#1F1F1F]">{formatCurrency(total)}/mo</span>
                    </div>

                    <div className="pt-2 border-t border-[#E8E6E1] space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#8C7C6D]">Start Date</span>
                        <span className="text-[#1F1F1F]">{formatDate(subscriptionData?.subscription_start_date)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#8C7C6D]">Next Renewal</span>
                        <span className="text-[#1F1F1F]">{formatDate(subscriptionData?.next_renewal_date)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#8C7C6D]">Payment Method</span>
                        {currentPaymentMethod ? (
                          <span className="text-[#1F1F1F]">
                            {currentPaymentMethod.type === 'card' ? (
                              `${currentPaymentMethod.card?.brand?.toUpperCase()} •••• ${currentPaymentMethod.card?.last4}`
                            ) : (
                              `Bank •••• ${currentPaymentMethod.us_bank_account?.last4}`
                            )}
                          </span>
                        ) : (
                          <span className="text-[#1F1F1F]">None</span>
                        )}
                      </div>
                    </div>

                    <div className="pt-2">
                      <Button
                        onClick={() => setShowUpdatePaymentModal(true)}
                        className="w-full bg-[#A59480] text-white hover:bg-[#8C7C6D] h-8 text-xs"
                        size="sm"
                      >
                        <CreditCard className="w-3 h-3 mr-2" />
                        Update Payment Method
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Referral Link */}
                {member?.referral_code && (
                  <a
                    href={`sms:?&body=Join me at NOIR KC! Use my referral link: https://noirkc.com/refer/${member.referral_code}`}
                    onClick={(e) => e.stopPropagation()}
                    className="block bg-gradient-to-r from-[#A59480] to-[#8C7C6D] hover:from-[#8C7C6D] hover:to-[#7A6B5D] text-white rounded-lg p-4 transition-all shadow-[0_4px_12px_rgba(0,0,0,0.3)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.4)]"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <p className="text-2xl" style={{ fontFamily: 'CONEBARS' }}>Share Noir</p>
                      <p className="text-xs font-normal">(click here to send text)</p>
                      <p className="text-[10px] font-normal"><span className="font-bold">Referral Link:</span> noirkc.com/refer/{member.referral_code}</p>
                    </div>
                  </a>
                )}

                {/* Members Section */}
                <div className="bg-white rounded-xl p-4 border border-[#ECEAE5]">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-semibold text-[#1F1F1F]">
                      Account Members ({accountMembers.length})
                    </h3>
                    <Button
                      onClick={() => setShowAddMemberModal(true)}
                      className="bg-[#A59480] text-white hover:bg-[#8C7C6D] h-8 text-xs"
                      size="sm"
                    >
                      <Plus className="w-3 h-3 mr-1.5" />
                      Add Member
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {accountMembers.map((member) => (
                      <div
                        key={member.member_id}
                        className="flex items-center justify-between p-2.5 bg-[#F6F5F2] rounded-lg"
                      >
                        <div className="flex items-center gap-2.5">
                          <Users className="w-4 h-4 text-[#A59480]" />
                          <div>
                            <p className="text-xs font-medium text-[#1F1F1F]">
                              {member.first_name} {member.last_name}
                            </p>
                            <p className="text-[10px] text-[#5A5A5A]">{member.email}</p>
                          </div>
                        </div>
                        {member.member_type === 'primary' ? (
                          <Badge className="bg-[#4CAF50] text-white text-[10px] px-2 py-0.5">Primary</Badge>
                        ) : (
                          <Badge className="bg-[#DAD7D0] text-[#5A5A5A] text-[10px] px-2 py-0.5">
                            {additionalMemberFee > 0 ? `+$${additionalMemberFee.toFixed(0)}/mo` : 'Included'}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Update Payment Modal */}
      {accountId && showUpdatePaymentModal && (
        <UpdatePaymentModal
          accountId={accountId}
          onSuccess={() => {
            setShowUpdatePaymentModal(false);
            fetchCurrentPaymentMethod();
            fetchSubscriptionData();
          }}
          onClose={() => setShowUpdatePaymentModal(false)}
        />
      )}

      {/* Add Member Modal */}
      {accountId && showAddMemberModal && (
        <AddSecondaryMemberModal
          accountId={accountId}
          onClose={() => setShowAddMemberModal(false)}
          onSuccess={() => {
            setShowAddMemberModal(false);
            fetchAccountMembers();
            fetchSubscriptionData();
          }}
        />
      )}
    </>
  );
}

export default function SubscriptionModal(props: SubscriptionModalProps) {
  return <SubscriptionModalContent {...props} />;
}
