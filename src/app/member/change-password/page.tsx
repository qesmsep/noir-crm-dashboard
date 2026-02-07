"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMemberAuth } from '@/context/MemberAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/useToast';
import { Eye, EyeOff, AlertTriangle } from 'lucide-react';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { member, loading } = useMemberAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !member) {
      router.push('/member/login');
    }
  }, [loading, member, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (newPassword.length < 8) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 8 characters long',
        variant: 'error',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please make sure both passwords match',
        variant: 'error',
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/member/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to change password');
      }

      toast({
        title: 'Password updated',
        description: 'Your password has been changed successfully',
        variant: 'success',
      });

      // Redirect to dashboard
      router.push('/member/dashboard');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to change password',
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#ECEDE8] flex items-center justify-center">
        <p className="text-[#A59480]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#ECEDE8] py-8">
      <div className="max-w-md mx-auto px-4">
        <div className="flex flex-col gap-6">
          {/* Logo */}
          <div className="text-center">
            <img
              src="/images/noir-wedding-day.png"
              alt="Noir"
              className="h-10 mx-auto mb-6"
            />
          </div>

          <Card className="bg-white rounded-2xl border border-[#ECEAE5] shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-[#1F1F1F]">
                Change Your Password
              </CardTitle>
              <p className="text-[#5A5A5A] mt-2 text-sm">
                Please set a new password for your account
              </p>
            </CardHeader>

            <CardContent>
              {member?.password_is_temporary && (
                <Alert className="mb-6 bg-yellow-50 border-yellow-200">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-sm text-yellow-800">
                    You are using a temporary password. Please change it to a secure password of your choice.
                  </AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit}>
                <div className="flex flex-col gap-4">
                  <div>
                    <Label htmlFor="currentPassword" className="text-[#1F1F1F] text-sm">
                      Current Password *
                    </Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type={showCurrent ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        required
                        className="border-[#DAD7D0] focus:border-[#A59480] focus:ring-[#A59480] pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrent(!showCurrent)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="newPassword" className="text-[#1F1F1F] text-sm">
                      New Password *
                    </Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNew ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password (min 8 characters)"
                        required
                        className="border-[#DAD7D0] focus:border-[#A59480] focus:ring-[#A59480] pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(!showNew)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword" className="text-[#1F1F1F] text-sm">
                      Confirm New Password *
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirm ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        required
                        className="border-[#DAD7D0] focus:border-[#A59480] focus:ring-[#A59480] pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full bg-[#A59480] text-white hover:bg-[#8C7C6D] mt-4"
                    disabled={submitting}
                  >
                    {submitting ? 'Updating...' : 'Update Password'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
