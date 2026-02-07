"use client";

import React, { useState } from 'react';
import { useMemberAuth } from '@/context/MemberAuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/useToast';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<'phone' | 'verify'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { signInWithPhone, setPassword } = useMemberAuth();
  const { toast } = useToast();
  const router = useRouter();

  // Send OTP to phone
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signInWithPhone(phone);
      setStep('verify');
      toast({
        title: 'Code sent',
        description: 'Check your phone for the verification code.',
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send verification code',
        variant: 'error',
      });
    } finally{
      setLoading(false);
    }
  };

  // Reset password with OTP
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please make sure both passwords are the same.',
        variant: 'error',
      });
      return;
    }

    // Validate password requirements
    if (newPassword.length < 8) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 8 characters.',
        variant: 'error',
      });
      return;
    }

    setLoading(true);

    try {
      await setPassword(phone, otp, newPassword);
      toast({
        title: 'Password reset successful',
        description: 'You can now sign in with your new password.',
        variant: 'success',
      });
      router.push('/member/login');
    } catch (error: any) {
      toast({
        title: 'Reset failed',
        description: error.message || 'Failed to reset password',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#ECEDE8] flex items-center justify-center">
      <div className="w-full max-w-md px-4 py-8 md:py-12">
        <div className="flex flex-col gap-8">
          {/* Logo */}
          <div className="text-center">
            <img
              src="/images/noir-wedding-day.png"
              alt="Noir"
              className="h-12 mx-auto mb-4"
            />
            <h1 className="text-2xl font-bold text-[#1F1F1F]">
              Reset Password
            </h1>
            <p className="mt-2 text-[#5A5A5A] text-sm">
              {step === 'phone'
                ? 'Enter your phone number to receive a verification code'
                : 'Enter the code and your new password'}
            </p>
          </div>

          {/* Reset Card */}
          <div className="bg-white rounded-2xl border border-[#ECEAE5] shadow-sm p-6 md:p-8">
            {step === 'phone' ? (
              <form onSubmit={handleSendOTP}>
                <div className="flex flex-col gap-5">
                  <div>
                    <Label htmlFor="phone" className="text-[#2C2C2C] font-medium">
                      Phone Number *
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                      required
                      className="h-12 border-[#DAD7D0] focus:border-[#A59480] focus:ring-[#A59480]"
                    />
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="bg-[#A59480] text-white hover:bg-[#8f7e6b] transition-all hover:-translate-y-0.5 active:translate-y-0 mt-2"
                    disabled={loading}
                  >
                    {loading ? 'Sending code...' : 'Send Verification Code'}
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword}>
                <div className="flex flex-col gap-5">
                  <div>
                    <Label htmlFor="otp" className="text-[#2C2C2C] font-medium text-center block">
                      Verification Code
                    </Label>
                    <Input
                      id="otp"
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="123456"
                      required
                      maxLength={6}
                      className="h-12 border-[#DAD7D0] focus:border-[#A59480] focus:ring-[#A59480] text-center text-lg tracking-widest"
                    />
                  </div>

                  <div>
                    <Label htmlFor="newPassword" className="text-[#2C2C2C] font-medium">
                      New Password *
                    </Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      required
                      className="h-12 border-[#DAD7D0] focus:border-[#A59480] focus:ring-[#A59480]"
                    />
                    <p className="text-xs text-[#8C7C6D] mt-1">
                      Minimum 8 characters, include uppercase, lowercase, and number
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword" className="text-[#2C2C2C] font-medium">
                      Confirm Password *
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      required
                      className="h-12 border-[#DAD7D0] focus:border-[#A59480] focus:ring-[#A59480]"
                    />
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="bg-[#A59480] text-white hover:bg-[#8f7e6b] transition-all hover:-translate-y-0.5 active:translate-y-0 mt-2"
                    disabled={loading}
                  >
                    {loading ? 'Resetting password...' : 'Reset Password'}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-[#A59480] hover:bg-transparent"
                    onClick={() => {
                      setStep('phone');
                      setOtp('');
                      setNewPassword('');
                      setConfirmPassword('');
                    }}
                  >
                    Try a different number
                  </Button>
                </div>
              </form>
            )}
          </div>

          {/* Footer */}
          <div className="text-center">
            <Link
              href="/member/login"
              className="text-[#A59480] text-sm font-medium hover:underline"
            >
              ← Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
