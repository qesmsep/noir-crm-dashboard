"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { LogOut, Camera, CreditCard, Plus, Check, Trash2 } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// ──────────────────────────────────────────────
// Payment Method types
// ──────────────────────────────────────────────

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
}

// ──────────────────────────────────────────────
// Add Card Form (needs Stripe Elements context)
// ──────────────────────────────────────────────

function AddCardForm({
  accountId,
  onSuccess,
  onCancel,
}: {
  accountId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setCardError(null);

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
    });

    if (error) {
      setCardError(error.message || 'Failed to process card');
      setProcessing(false);
      return;
    }

    try {
      const response = await fetch('/api/setupPaymentMethod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId,
          payment_method_id: paymentMethod.id,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save card');
      }

      onSuccess();
    } catch (err: any) {
      setCardError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div
        className="border border-[#DAD7D0] rounded-[10px] p-4 mb-3 bg-white"
        style={{ minHeight: 44 }}
      >
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '15px',
                fontFamily: "'Montserrat', sans-serif",
                color: '#1F1F1F',
                '::placeholder': { color: '#ABA8A1' },
              },
              invalid: { color: '#e53e3e' },
            },
          }}
        />
      </div>
      {cardError && (
        <p className="text-sm text-red-600 mb-3">{cardError}</p>
      )}
      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={!stripe || processing}
          className="flex-1 bg-[#A59480] text-white hover:bg-[#8C7C6D] rounded-[10px] font-semibold text-sm"
          style={{
            boxShadow: '0 1px 2px rgba(165,148,128,0.15), 0 4px 8px rgba(165,148,128,0.25), 0 8px 16px rgba(165,148,128,0.18)',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {processing ? 'Adding...' : 'Add Card'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={processing}
          className="flex-1 border-[#DAD7D0] text-[#1F1F1F] hover:border-[#A59480] hover:text-[#A59480] rounded-[10px] font-semibold text-sm"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ──────────────────────────────────────────────
// Main Profile Page
// ──────────────────────────────────────────────

export default function MemberProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { member, loading, refreshMember, signOut } = useMemberAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
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
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);
  const [removingCard, setRemovingCard] = useState<string | null>(null);

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
    }
  }, [member, loading, router]);

  // Fetch payment methods
  const fetchPaymentMethods = useCallback(async () => {
    if (!member?.account_id) return;
    setLoadingPayments(true);
    try {
      const response = await fetch(`/api/listPaymentMethods?account_id=${member.account_id}`);
      if (!response.ok) throw new Error('Failed to fetch payment methods');
      const data = await response.json();
      setPaymentMethods(data.payment_methods || []);
    } catch (err: any) {
      console.error('Error fetching payment methods:', err);
    } finally {
      setLoadingPayments(false);
    }
  }, [member?.account_id]);

  useEffect(() => {
    if (member?.account_id) {
      fetchPaymentMethods();
    }
  }, [member?.account_id, fetchPaymentMethods]);

  // ── Profile photo upload ──
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a JPEG, PNG, or WebP image.',
        variant: 'error',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 5MB.',
        variant: 'error',
      });
      return;
    }

    setUploadingPhoto(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const response = await fetch('/api/member/upload-profile-photo', {
        method: 'POST',
        credentials: 'include',
        body: formDataUpload,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload photo');
      }

      await refreshMember();

      toast({
        title: 'Photo updated',
        description: 'Your profile photo has been updated',
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload photo',
        variant: 'error',
      });
    } finally {
      setUploadingPhoto(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // ── Profile save ──
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

  // ── Payment methods actions ──
  const handleSetDefault = async (paymentMethodId: string) => {
    setSettingDefault(paymentMethodId);
    try {
      const response = await fetch('/api/setDefaultPaymentMethod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: member?.account_id,
          payment_method_id: paymentMethodId,
        }),
      });
      if (!response.ok) throw new Error('Failed to set default');
      await fetchPaymentMethods();
      toast({
        title: 'Default updated',
        description: 'Your default payment method has been changed',
        variant: 'success',
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to update default payment method',
        variant: 'error',
      });
    } finally {
      setSettingDefault(null);
    }
  };

  const handleRemoveCard = async (paymentMethodId: string) => {
    setRemovingCard(paymentMethodId);
    try {
      const response = await fetch('/api/removePaymentMethod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: member?.account_id,
          payment_method_id: paymentMethodId,
        }),
      });
      if (!response.ok) throw new Error('Failed to remove card');
      await fetchPaymentMethods();
      toast({
        title: 'Card removed',
        description: 'Payment method has been removed',
        variant: 'success',
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to remove card',
        variant: 'error',
      });
    } finally {
      setRemovingCard(null);
    }
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

  // ── Card brand display helper ──
  const formatBrand = (brand: string) => {
    const brands: Record<string, string> = {
      visa: 'Visa',
      mastercard: 'Mastercard',
      amex: 'Amex',
      discover: 'Discover',
      diners: 'Diners',
      jcb: 'JCB',
      unionpay: 'UnionPay',
    };
    return brands[brand.toLowerCase()] || brand.toUpperCase();
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
    <div className="min-h-screen bg-[#ECEDE8] pb-20">
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
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
        <div className="flex flex-col gap-6">
          {/* Page Title */}
          <div>
            <h1 className="text-3xl md:text-4xl text-[#1F1F1F] mb-2" style={{ fontFamily: 'CONEBARS' }}>
              Welcome back, {member.first_name}
            </h1>
          </div>

          {/* Profile Card */}
          <Card className="bg-white rounded-2xl border border-[#ECEAE5]" style={{ boxShadow: '0 4px 12px rgba(165, 148, 128, 0.08)' }}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Avatar with photo upload overlay */}
                  <div className="relative group">
                    <Avatar className="h-16 w-16 bg-[#A59480]">
                      <AvatarImage src={member.profile_photo_url || undefined} />
                      <AvatarFallback className="bg-[#A59480] text-white text-lg font-semibold">
                        {member.first_name[0]}{member.last_name[0]}
                      </AvatarFallback>
                    </Avatar>
                    {/* Upload overlay */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 group-hover:bg-black/40 transition-all duration-200 cursor-pointer"
                      aria-label="Change profile photo"
                    >
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        {uploadingPhoto ? (
                          <Spinner size="sm" className="text-white" />
                        ) : (
                          <Camera className="w-5 h-5 text-white" />
                        )}
                      </div>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      aria-hidden="true"
                    />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-[#1F1F1F]">
                      {member.first_name} {member.last_name}
                    </h2>
                    <Badge className="bg-[#A59480] text-white px-2 py-1 text-xs mt-1">
                      {member.membership} Member
                    </Badge>
                  </div>
                </div>
                {!editing && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-[#A59480] text-[#A59480] hover:bg-[#A59480] hover:text-white rounded-[10px] font-semibold text-sm"
                    onClick={() => setEditing(true)}
                    style={{
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    Edit Profile
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent>
              <div className="flex flex-col gap-4">
                <div>
                  <Label htmlFor="first_name" className="text-[#1F1F1F] text-sm">First Name</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    readOnly={!editing}
                    className={`border-[#DAD7D0] ${editing ? 'bg-white' : 'bg-[#F6F5F2]'} focus:border-[#A59480] focus:ring-[#A59480]`}
                  />
                </div>

                <div>
                  <Label htmlFor="last_name" className="text-[#1F1F1F] text-sm">Last Name</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    readOnly={!editing}
                    className={`border-[#DAD7D0] ${editing ? 'bg-white' : 'bg-[#F6F5F2]'} focus:border-[#A59480] focus:ring-[#A59480]`}
                  />
                </div>

                <div>
                  <Label htmlFor="email" className="text-[#1F1F1F] text-sm">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    readOnly={!editing}
                    className={`border-[#DAD7D0] ${editing ? 'bg-white' : 'bg-[#F6F5F2]'} focus:border-[#A59480] focus:ring-[#A59480]`}
                  />
                </div>

                <div>
                  <Label htmlFor="phone" className="text-[#1F1F1F] text-sm">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    readOnly
                    className="border-[#DAD7D0] bg-[#F6F5F2] cursor-not-allowed"
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
                      className="flex-1 bg-[#A59480] text-white hover:bg-[#8C7C6D] rounded-[10px] font-semibold"
                      onClick={handleSave}
                      disabled={saving}
                      style={{
                        boxShadow: '0 1px 2px rgba(165,148,128,0.15), 0 4px 8px rgba(165,148,128,0.25), 0 8px 16px rgba(165,148,128,0.18)',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 border-[#DAD7D0] text-[#2C2C2C] hover:border-[#A59480] hover:text-[#A59480] rounded-[10px] font-semibold"
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
          <Card className="bg-white rounded-2xl border border-[#ECEAE5]" style={{ boxShadow: '0 4px 12px rgba(165, 148, 128, 0.08)' }}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-[#A59480]" />
                  <CardTitle className="text-xl font-semibold text-[#1F1F1F]">
                    Payment Methods
                  </CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingPayments ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner size="md" className="text-[#A59480]" />
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {paymentMethods.length === 0 && !showAddCard && (
                    <div className="text-center py-6">
                      <CreditCard className="w-10 h-10 text-[#ABA8A1] mx-auto mb-3" />
                      <p className="text-sm text-[#5A5A5A] mb-1">No payment methods on file</p>
                      <p className="text-xs text-[#868686]">Add a card to make payments easier</p>
                    </div>
                  )}

                  {paymentMethods.map((method) => (
                    <div
                      key={method.id}
                      className="flex items-center justify-between p-4 border border-[#ECEAE5] rounded-[12px] bg-[#FBFBFA]"
                      style={{
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex-shrink-0 w-10 h-7 rounded bg-[#F7F6F2] border border-[#ECEAE5] flex items-center justify-center">
                          <CreditCard className="w-4 h-4 text-[#A59480]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#1F1F1F]">
                            {formatBrand(method.brand)} ending in {method.last4}
                          </p>
                          <p className="text-xs text-[#868686]">
                            Expires {String(method.exp_month).padStart(2, '0')}/{method.exp_year}
                          </p>
                        </div>
                        {method.is_default && (
                          <Badge className="bg-[#A59480]/10 text-[#A59480] border-0 text-xs px-2 py-0.5 flex-shrink-0">
                            Default
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        {!method.is_default && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSetDefault(method.id)}
                              disabled={settingDefault === method.id}
                              className="text-xs text-[#A59480] hover:text-[#8C7C6D] hover:bg-[#F7F6F2] h-8 px-2"
                            >
                              {settingDefault === method.id ? (
                                <Spinner size="sm" className="text-[#A59480]" />
                              ) : (
                                <><Check className="w-3.5 h-3.5 mr-1" /> Set Default</>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveCard(method.id)}
                              disabled={removingCard === method.id}
                              className="text-xs text-[#868686] hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0"
                            >
                              {removingCard === method.id ? (
                                <Spinner size="sm" className="text-[#868686]" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Add Card Section */}
                  {showAddCard ? (
                    <div className="mt-2">
                      <Elements stripe={stripePromise}>
                        <AddCardForm
                          accountId={member.account_id}
                          onSuccess={() => {
                            setShowAddCard(false);
                            fetchPaymentMethods();
                            toast({
                              title: 'Card added',
                              description: 'Your new payment method has been saved',
                              variant: 'success',
                            });
                          }}
                          onCancel={() => setShowAddCard(false)}
                        />
                      </Elements>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => setShowAddCard(true)}
                      className="w-full border-[#DAD7D0] border-dashed text-[#A59480] hover:border-[#A59480] hover:bg-[#F7F6F2] rounded-[10px] font-semibold text-sm mt-1"
                      style={{
                        boxShadow: '0 1px 2px rgba(165,148,128,0.08), 0 4px 8px rgba(165,148,128,0.12), 0 8px 16px rgba(165,148,128,0.08)',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add New Card
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Account Settings Card */}
          <Card className="bg-white rounded-2xl border border-[#ECEAE5]" style={{ boxShadow: '0 4px 12px rgba(165, 148, 128, 0.08)' }}>
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
