"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMemberAuth } from '@/context/MemberAuthContext';
import MemberNav from '@/components/member/MemberNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/useToast';
import { Separator } from '@/components/ui/separator';
import { LogOut, CreditCard, Share2, Copy, Check, Building2 } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

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
        variant: 'success',
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
      <div>
        <Label className="text-[#1F1F1F] text-sm mb-2 block">Card Information</Label>
        <div className="border border-[#DAD7D0] rounded-md p-3 bg-white">
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
        <p className="text-xs text-[#8C7C6D] mt-2">
          Your card information is securely processed by Stripe. We never store your full card details.
        </p>
      </div>

      <div className="flex gap-3">
        <Button
          type="submit"
          className="flex-1 bg-[#A59480] text-white hover:bg-[#8C7C6D]"
          disabled={submitting || !stripe}
        >
          {submitting ? 'Adding...' : 'Add Card'}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1 border-[#DAD7D0] text-[#2C2C2C] hover:border-[#A59480] hover:text-[#A59480]"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

// Add Bank Account Form Component (ACH)
function AddBankAccountForm({ accountId, onSuccess, onCancel }: { accountId: string; onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [clientSecret, setClientSecret] = useState('');
  const [setupIntentId, setSetupIntentId] = useState('');

  useEffect(() => {
    // Create SetupIntent on component mount
    const createSetupIntent = async () => {
      try {
        const response = await fetch('/api/stripe/ach/setup-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account_id: accountId }),
        });

        const data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        setClientSecret(data.client_secret);
        setSetupIntentId(data.setup_intent_id);
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to initialize bank account setup',
          variant: 'error',
        });
      }
    };

    createSetupIntent();
  }, [accountId, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements || !clientSecret) {
      return;
    }

    setSubmitting(true);

    try {
      // Confirm the SetupIntent with the bank account details
      const { setupIntent, error: stripeError } = await stripe.confirmUsBankAccountSetup(clientSecret);

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      if (!setupIntent || !setupIntent.payment_method) {
        throw new Error('Failed to setup bank account');
      }

      // Set as default payment method
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
        description: 'Bank account added successfully. Verification may take 1-2 business days.',
        variant: 'success',
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add bank account',
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label className="text-[#1F1F1F] text-sm mb-2 block">Bank Account Information</Label>
        {clientSecret ? (
          <div className="border border-[#DAD7D0] rounded-md p-3 bg-white">
            <PaymentElement
              options={{
                layout: 'tabs',
                paymentMethodOrder: ['us_bank_account'],
              }}
            />
          </div>
        ) : (
          <div className="flex justify-center py-4">
            <Spinner className="text-[#A59480]" />
          </div>
        )}
        <p className="text-xs text-[#8C7C6D] mt-2">
          Your bank account will be verified instantly or via microdeposits. ACH payments typically take 3-5 business days to process.
        </p>
      </div>

      <div className="flex gap-3">
        <Button
          type="submit"
          className="flex-1 bg-[#A59480] text-white hover:bg-[#8C7C6D]"
          disabled={submitting || !stripe || !clientSecret}
        >
          {submitting ? 'Adding...' : 'Add Bank Account'}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1 border-[#DAD7D0] text-[#2C2C2C] hover:border-[#A59480] hover:text-[#A59480]"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

export default function MemberProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { member, loading, refreshMember, signOut } = useMemberAuth();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    contact_preferences: {
      sms: true,
      email: true,
    },
  });

  // Payment methods state
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState<string | null>(null);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(true);
  const [showAddCard, setShowAddCard] = useState(false);
  const [showAddBankAccount, setShowAddBankAccount] = useState(false);
  const [paymentMethodType, setPaymentMethodType] = useState<'card' | 'us_bank_account'>('card');

  // Referral tracking state
  const [referralStats, setReferralStats] = useState({ total: 0, active: 0 });
  const [loadingReferrals, setLoadingReferrals] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (!loading && !member) {
      router.push('/member/login');
    } else if (member) {
      setFormData({
        first_name: member.first_name || '',
        last_name: member.last_name || '',
        email: member.email || '',
        phone: member.phone || '',
        contact_preferences: member.contact_preferences || { sms: true, email: true },
      });
      fetchPaymentMethods();
      fetchReferralStats();
    }
  }, [member, loading, router]);

  const fetchPaymentMethods = async () => {
    if (!member?.account_id) return;

    try {
      const response = await fetch(`/api/stripe/payment-methods/list?account_id=${member.account_id}`);
      const data = await response.json();

      if (response.ok) {
        setPaymentMethods(data.payment_methods || []);
        setDefaultPaymentMethod(data.default_payment_method);
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
    } finally {
      setLoadingPaymentMethods(false);
    }
  };

  const fetchReferralStats = async () => {
    if (!member?.referral_code) {
      setLoadingReferrals(false);
      return;
    }

    try {
      const response = await fetch(`/api/member/referrals?code=${member.referral_code}`, {
        credentials: 'include',
      });
      const data = await response.json();

      if (response.ok) {
        setReferralStats(data.stats || { total: 0, active: 0 });
      }
    } catch (error) {
      console.error('Error fetching referral stats:', error);
    } finally {
      setLoadingReferrals(false);
    }
  };

  const copyReferralCode = () => {
    if (member?.referral_code) {
      navigator.clipboard.writeText(member.referral_code);
      setCopiedCode(true);
      toast({
        title: 'Copied!',
        description: 'Referral code copied to clipboard',
        variant: 'success',
      });
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      const response = await fetch('/api/member/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      await refreshMember();

      toast({
        title: 'Profile updated',
        description: 'Your changes have been saved successfully',
        variant: 'success',
      });

      setEditing(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update profile',
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (member) {
      setFormData({
        first_name: member.first_name || '',
        last_name: member.last_name || '',
        email: member.email || '',
        phone: member.phone || '',
        contact_preferences: member.contact_preferences || { sms: true, email: true },
      });
    }
    setEditing(false);
  };

  const handleLogout = async () => {
    try {
      await signOut();
      toast({
        title: 'Logged out',
        description: 'You have been signed out successfully',
        variant: 'success',
      });
      router.push('/member/login');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to log out',
        variant: 'error',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#ECEDE8]">
        <Spinner size="xl" className="text-[#A59480]" />
      </div>
    );
  }

  if (!member) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#ECEDE8] pb-20" style={{ touchAction: 'pan-y pinch-zoom', width: '100vw', maxWidth: '100vw', overflowX: 'hidden', position: 'relative' }}>
      {/* Header - Hidden on mobile */}
      <div className="bg-white border-b border-[#ECEAE5] sticky top-0 z-10 hidden md:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <img
              src="/images/noir-wedding-day.png"
              alt="Noir"
              className="h-8 cursor-pointer"
              onClick={() => router.push('/member/dashboard')}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6 lg:py-8" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        <div className="flex flex-col gap-6" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
          {/* Page Title */}
          <div className="max-w-full">
            <h1 className="text-3xl md:text-4xl text-[#1F1F1F] mb-2" style={{ fontFamily: 'CONEBARS' }}>
              Welcome back, {member.first_name}
            </h1>
          </div>

          {/* Profile Card */}
          <Card className="bg-white rounded-2xl border border-[#ECEAE5] shadow-sm" style={{ touchAction: 'pan-y pinch-zoom', width: '100%', maxWidth: '100%', overflow: 'hidden', boxSizing: 'border-box' }}>
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Avatar className="h-12 w-12 md:h-14 md:w-14 bg-[#A59480] flex-shrink-0">
                    <AvatarImage src={member.profile_photo_url || undefined} />
                    <AvatarFallback className="bg-[#A59480] text-white">
                      {member.first_name[0]}{member.last_name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg md:text-xl font-semibold text-[#1F1F1F] truncate">
                      {member.first_name} {member.last_name}
                    </h2>
                    <Badge className="bg-[#A59480] text-white px-2 py-1 text-xs mt-1 inline-block">
                      {member.membership} Member
                    </Badge>
                  </div>
                </div>
                {!editing && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-[#A59480] text-[#A59480] hover:bg-[#A59480] hover:text-white flex-shrink-0 text-xs md:text-sm px-2 md:px-3"
                    onClick={() => setEditing(true)}
                  >
                    <span className="hidden sm:inline">Edit Profile</span>
                    <span className="sm:hidden">Edit</span>
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="max-w-full">
              <div className="flex flex-col gap-4 max-w-full">
                <div className="max-w-full">
                  <Label htmlFor="first_name" className="text-[#1F1F1F] text-sm">First Name</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    readOnly={!editing}
                    className={`border-[#DAD7D0] ${editing ? 'bg-white' : 'bg-[#F6F5F2]'} focus:border-[#A59480] focus:ring-[#A59480] w-full max-w-full`}
                  />
                </div>

                <div className="max-w-full">
                  <Label htmlFor="last_name" className="text-[#1F1F1F] text-sm">Last Name</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    readOnly={!editing}
                    className={`border-[#DAD7D0] ${editing ? 'bg-white' : 'bg-[#F6F5F2]'} focus:border-[#A59480] focus:ring-[#A59480] w-full max-w-full`}
                  />
                </div>

                <div className="max-w-full">
                  <Label htmlFor="email" className="text-[#1F1F1F] text-sm">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    readOnly={!editing}
                    className={`border-[#DAD7D0] ${editing ? 'bg-white' : 'bg-[#F6F5F2]'} focus:border-[#A59480] focus:ring-[#A59480] w-full max-w-full`}
                  />
                </div>

                <div className="max-w-full">
                  <Label htmlFor="phone" className="text-[#1F1F1F] text-sm">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    readOnly
                    className="border-[#DAD7D0] bg-[#F6F5F2] cursor-not-allowed w-full max-w-full"
                  />
                  <p className="text-xs text-[#8C7C6D] mt-1">
                    Phone number cannot be changed. Contact support if needed.
                  </p>
                </div>

                <Separator className="my-2" />

                <div>
                  <h3 className="text-lg font-semibold text-[#1F1F1F] mb-3">
                    Contact Preferences
                  </h3>

                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#1F1F1F] font-medium">
                          SMS Notifications
                        </p>
                        <p className="text-xs text-[#5A5A5A]">
                          Receive reservation reminders via text
                        </p>
                      </div>
                      <Switch
                        checked={formData.contact_preferences.sms}
                        onCheckedChange={(checked) => setFormData({
                          ...formData,
                          contact_preferences: {
                            ...formData.contact_preferences,
                            sms: checked,
                          },
                        })}
                        disabled={!editing}
                        className="data-[state=checked]:bg-[#A59480]"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#1F1F1F] font-medium">
                          Email Notifications
                        </p>
                        <p className="text-xs text-[#5A5A5A]">
                          Receive updates and offers via email
                        </p>
                      </div>
                      <Switch
                        checked={formData.contact_preferences.email}
                        onCheckedChange={(checked) => setFormData({
                          ...formData,
                          contact_preferences: {
                            ...formData.contact_preferences,
                            email: checked,
                          },
                        })}
                        disabled={!editing}
                        className="data-[state=checked]:bg-[#A59480]"
                      />
                    </div>
                  </div>
                </div>

                {editing && (
                  <div className="flex gap-3 mt-4">
                    <Button
                      className="flex-1 bg-[#A59480] text-white hover:bg-[#8C7C6D]"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 border-[#DAD7D0] text-[#2C2C2C] hover:border-[#A59480] hover:text-[#A59480]"
                      onClick={handleCancel}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payment Methods Card */}
          <Card className="bg-white rounded-2xl border border-[#ECEAE5] shadow-sm" style={{ touchAction: 'pan-y pinch-zoom', width: '100%', maxWidth: '100%', overflow: 'hidden', boxSizing: 'border-box' }}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <CreditCard className="w-5 h-5 text-[#A59480] flex-shrink-0" />
                  <CardTitle className="text-lg md:text-xl font-semibold text-[#1F1F1F] truncate">
                    Payment Methods
                  </CardTitle>
                </div>
                {!showAddCard && !showAddBankAccount && !loadingPaymentMethods && (
                  <div className="flex gap-1.5 md:gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#A59480] text-[#A59480] hover:bg-[#A59480] hover:text-white text-xs px-2 md:px-3"
                      onClick={() => setShowAddCard(true)}
                    >
                      <CreditCard className="w-3 h-3 md:w-4 md:h-4 md:mr-1" />
                      <span className="hidden sm:inline">Add Card</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#A59480] text-[#A59480] hover:bg-[#A59480] hover:text-white text-xs px-2 md:px-3"
                      onClick={() => setShowAddBankAccount(true)}
                    >
                      <Building2 className="w-3 h-3 md:w-4 md:h-4 md:mr-1" />
                      <span className="hidden sm:inline">Add Bank</span>
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="max-w-full">
              {loadingPaymentMethods ? (
                <div className="flex justify-center py-4">
                  <Spinner className="text-[#A59480]" />
                </div>
              ) : showAddCard ? (
                <Elements stripe={stripePromise}>
                  <AddCardForm
                    accountId={member.account_id}
                    onSuccess={() => {
                      setShowAddCard(false);
                      fetchPaymentMethods();
                    }}
                    onCancel={() => setShowAddCard(false)}
                  />
                </Elements>
              ) : showAddBankAccount ? (
                <Elements stripe={stripePromise}>
                  <AddBankAccountForm
                    accountId={member.account_id}
                    onSuccess={() => {
                      setShowAddBankAccount(false);
                      fetchPaymentMethods();
                    }}
                    onCancel={() => setShowAddBankAccount(false)}
                  />
                </Elements>
              ) : paymentMethods.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {paymentMethods.map((pm) => {
                    const isCard = pm.type === 'card';
                    const isBankAccount = pm.type === 'us_bank_account';

                    return (
                      <div
                        key={pm.id}
                        className="flex items-center justify-between gap-2 p-3 border border-[#ECEAE5] rounded-lg bg-[#F6F5F2]"
                      >
                        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                          {isCard && <CreditCard className="w-4 h-4 md:w-5 md:h-5 text-[#5A5A5A] flex-shrink-0" />}
                          {isBankAccount && <Building2 className="w-4 h-4 md:w-5 md:h-5 text-[#5A5A5A] flex-shrink-0" />}
                          <div className="min-w-0 flex-1">
                            {isCard && (
                              <>
                                <p className="text-sm font-medium text-[#1F1F1F] truncate">
                                  {pm.card.brand.charAt(0).toUpperCase() + pm.card.brand.slice(1)} •••• {pm.card.last4}
                                </p>
                                <p className="text-xs text-[#8C7C6D]">
                                  Expires {pm.card.exp_month}/{pm.card.exp_year}
                                </p>
                              </>
                            )}
                            {isBankAccount && (
                              <>
                                <p className="text-sm font-medium text-[#1F1F1F] truncate">
                                  {pm.us_bank_account.bank_name || 'Bank Account'} •••• {pm.us_bank_account.last4}
                                </p>
                                <p className="text-xs text-[#8C7C6D]">
                                  {pm.us_bank_account.account_type.charAt(0).toUpperCase() + pm.us_bank_account.account_type.slice(1)} • ACH
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                        {defaultPaymentMethod === pm.id && (
                          <Badge className="bg-[#4CAF50] text-white px-2 py-1 text-xs flex-shrink-0">
                            Default
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                  <p className="text-xs text-[#8C7C6D] mt-2">
                    Your default payment method will be used for balance payments and reservations.
                  </p>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-[#5A5A5A] mb-3">
                    No payment methods on file
                  </p>
                  <p className="text-xs text-[#8C7C6D]">
                    Add a card to pay your balance and secure reservations
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Referral Tracking Card */}
          {member.referral_code && (
            <Card className="bg-white rounded-2xl border border-[#ECEAE5] shadow-sm" style={{ touchAction: 'pan-y pinch-zoom', width: '100%', maxWidth: '100%', overflow: 'hidden', boxSizing: 'border-box' }}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-[#A59480]" />
                  <CardTitle className="text-xl font-semibold text-[#1F1F1F]">
                    Referral Program
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {loadingReferrals ? (
                  <div className="flex justify-center py-4">
                    <Spinner className="text-[#A59480]" />
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between p-4 bg-[#F6F5F2] rounded-lg border border-[#ECEAE5]">
                      <div>
                        <p className="text-xs text-[#8C7C6D] mb-1">Your Referral Code</p>
                        <p className="text-xl font-semibold text-[#1F1F1F] tracking-wider">
                          {member.referral_code}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-[#A59480] text-[#A59480] hover:bg-[#A59480] hover:text-white"
                        onClick={copyReferralCode}
                      >
                        {copiedCode ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-[#FBFBFA] rounded-lg border border-[#ECEAE5]">
                        <p className="text-xs text-[#8C7C6D] mb-1">Total Referrals</p>
                        <p className="text-2xl font-bold text-[#A59480]">{referralStats.total}</p>
                      </div>
                      <div className="p-4 bg-[#FBFBFA] rounded-lg border border-[#ECEAE5]">
                        <p className="text-xs text-[#8C7C6D] mb-1">Active Members</p>
                        <p className="text-2xl font-bold text-[#4CAF50]">{referralStats.active}</p>
                      </div>
                    </div>

                    <p className="text-xs text-[#8C7C6D]">
                      Share your referral code with friends. When they join Noir using your code, you'll both receive benefits!
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Account Settings Card */}
          <Card className="bg-white rounded-2xl border border-[#ECEAE5] shadow-sm" style={{ touchAction: 'pan-y pinch-zoom', width: '100%', maxWidth: '100%', overflow: 'hidden', boxSizing: 'border-box' }}>
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-[#1F1F1F]">
                Account Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <Button
                  variant="ghost"
                  className="justify-start text-[#2C2C2C] hover:bg-[#F6F5F2] hover:text-[#A59480]"
                  onClick={() => router.push('/member/change-password')}
                >
                  Change Password
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start text-[#2C2C2C] hover:bg-[#F6F5F2] hover:text-[#A59480]"
                  onClick={() => router.push('/member/settings')}
                >
                  Security Settings
                </Button>
                <Separator className="my-1" />
                <Button
                  variant="ghost"
                  className="justify-start text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Log Out
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Navigation */}
      <MemberNav />
    </div>
  );
}
