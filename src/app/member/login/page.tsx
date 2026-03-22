"use client";

import React, { useState } from 'react';
import { useMemberAuth } from '@/context/MemberAuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/useToast';
import { PhoneDialPad } from '@/components/member/PhoneDialPad';
import { Fingerprint } from 'lucide-react';
import { FEATURES } from '@/lib/features';

export default function MemberLoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [memberInfo, setMemberInfo] = useState<{ first_name: string; has_password: boolean } | null>(null);
  const [phoneNotRecognized, setPhoneNotRecognized] = useState(false);

  const { signInWithPassword, signInWithBiometric, signInWithPhone, verifyOTP, isBiometricAvailable, member } = useMemberAuth();
  const { toast } = useToast();
  const router = useRouter();

  // Check biometric availability on mount
  React.useEffect(() => {
    isBiometricAvailable().then(setBiometricAvailable);
  }, [isBiometricAvailable]);

  // Redirect if already logged in
  React.useEffect(() => {
    if (member) {
      // If member needs to set up a password, redirect to change-password page
      if (!member.has_password || member.password_is_temporary) {
        router.push('/member/change-password');
      } else {
        router.push('/member/dashboard');
      }
    }
  }, [member, router]);

  // Handle dial pad "Call" button - verify phone first, then show password input
  const handleCall = async () => {
    if (!phone || phone.length < 10) {
      toast({
        title: 'Phone number required',
        description: 'Please enter your 10-digit phone number',
        variant: 'warning',
      });
      return;
    }

    setLoading(true);
    setPhoneNotRecognized(false);

    try {
      const response = await fetch('/api/member/verify-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.exists) {
        // Phone number recognized - store member info and show password/OTP screen
        setMemberInfo(data.member);
        setShowPasswordInput(true);
      } else {
        // Phone number not recognized
        setPhoneNotRecognized(true);
        toast({
          title: 'Phone number not recognized',
          description: 'Please text us at 913-777-4488 for assistance',
          variant: 'error',
          duration: 8000,
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to verify phone number',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle going back to dial pad
  const handleBackToDialPad = () => {
    setShowPasswordInput(false);
    setShowOtpInput(false);
    setPassword('');
    setOtp('');
    setMemberInfo(null);
    setPhoneNotRecognized(false);
  };

  // Handle request OTP
  const handleRequestOTP = async () => {
    if (!phone || phone.length < 10) {
      toast({
        title: 'Phone number required',
        description: 'Please enter your 10-digit phone number',
        variant: 'warning',
      });
      return;
    }

    setLoading(true);

    try {
      await signInWithPhone(phone);
      // Transition to OTP input screen
      setShowPasswordInput(false);
      setShowOtpInput(true);
      toast({
        title: 'Code sent',
        description: 'Check your phone for a 6-digit verification code',
        variant: 'success',
      });
    } catch (error: any) {
      toast({
        title: 'Failed to send code',
        description: error.message || 'Please try again',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP login
  const handleOtpLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const needsPassword = await verifyOTP(phone, otp);

      // Show appropriate message and redirect based on password status
      if (needsPassword) {
        toast({
          title: 'Welcome!',
          description: 'Please set a password for your account to continue.',
          variant: 'success',
        });
        router.push('/member/change-password');
      } else {
        toast({
          title: 'Welcome back',
          description: 'You are now signed in.',
          variant: 'success',
        });
        router.push('/member/dashboard');
      }
    } catch (error: any) {
      toast({
        title: 'Verification failed',
        description: error.message || 'Invalid code. Please try again.',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle password login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const isTemporary = await signInWithPassword(phone, password);

      // Show appropriate message and redirect based on password status
      if (isTemporary) {
        toast({
          title: 'Password change required',
          description: 'Please set a new password to continue.',
          variant: 'warning',
        });
        router.push('/member/change-password');
      } else {
        toast({
          title: 'Welcome back',
          description: 'You are now signed in.',
          variant: 'success',
        });
        router.push('/member/dashboard');
      }
    } catch (error: any) {
      toast({
        title: 'Login failed',
        description: error.message || 'Invalid phone number or password',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle biometric login
  const handleBiometricLogin = async () => {
    if (!phone) {
      toast({
        title: 'Phone number required',
        description: 'Please enter your phone number first',
        variant: 'warning',
      });
      return;
    }

    setLoading(true);

    try {
      await signInWithBiometric(phone);
      toast({
        title: 'Welcome back',
        description: 'You are now signed in.',
        variant: 'success',
      });
      // Note: Redirect is handled by the "already logged in" useEffect above
    } catch (error: any) {
      toast({
        title: 'Biometric login failed',
        description: error.message || 'Please try using your password instead',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#ECEDE8] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex flex-col gap-8">
          {/* Logo */}
          <div className="text-center">
            <img
              src="/images/noir-wedding-day.png"
              alt="Noir"
              className="h-12 mx-auto mb-6"
              style={{ filter: 'brightness(0.7)' }}
            />
            {showPasswordInput && memberInfo ? (
              <div className="space-y-2">
                <h2 className="text-[#1F1F1F] text-xl font-semibold">
                  Welcome back, {memberInfo.first_name}
                </h2>
                <p className="text-[#5A5A5A] text-sm">
                  Please enter your password to access your member portal
                </p>
              </div>
            ) : showOtpInput ? (
              <p className="text-[#5A5A5A] text-sm">Enter verification code</p>
            ) : (
              <p className="text-[#5A5A5A] text-sm">Dial your phone number</p>
            )}
          </div>

          {/* Login Card */}
          <div className="bg-white rounded-2xl border border-[#ECEAE5] shadow-sm p-6 md:p-8">
            {!showPasswordInput && !showOtpInput ? (
              /* Phone Dial Pad View */
              <div className="flex flex-col gap-6">
                <PhoneDialPad
                  value={phone}
                  onChange={setPhone}
                  onCall={handleCall}
                />

                {/* Unrecognized Phone Error */}
                {phoneNotRecognized && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-center">
                    <p className="text-red-800 font-medium mb-2">
                      Phone number not recognized
                    </p>
                    <p className="text-red-700 text-sm">
                      Our apologies, but we do not recognize this phone number. Please text us at{' '}
                      <a href="sms:913-777-4488" className="font-semibold underline">
                        913-777-4488
                      </a>{' '}
                      so we can remedy this issue immediately.
                    </p>
                  </div>
                )}
              </div>
            ) : showOtpInput ? (
              /* OTP Input View */
              <form onSubmit={handleOtpLogin}>
                <div className="flex flex-col gap-5">
                  {/* OTP Input */}
                  <div>
                    <Label htmlFor="otp" className="text-[#2C2C2C] font-medium text-center block">
                      Verification Code
                    </Label>
                    <Input
                      id="otp"
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456"
                      required
                      autoFocus
                      maxLength={6}
                      className="h-14 border-[#DAD7D0] focus:border-[#A59480] focus:ring-[#A59480] text-center text-2xl tracking-widest font-semibold"
                    />
                    <p className="text-xs text-[#8C7C6D] mt-2 text-center">
                      Enter the 6-digit code sent to your phone
                    </p>
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    size="lg"
                    className="bg-[#A59480] text-white hover:bg-[#8f7e6b] transition-all hover:-translate-y-0.5 active:translate-y-0 mt-2"
                    disabled={loading || otp.length !== 6}
                  >
                    {loading ? 'Verifying...' : 'Verify Code'}
                  </Button>

                  {/* Resend Code */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-[#A59480] hover:bg-transparent"
                    onClick={handleRequestOTP}
                    disabled={loading}
                  >
                    Resend Code
                  </Button>

                  {/* Back to Dial Pad */}
                  <Button
                    type="button"
                    size="lg"
                    variant="ghost"
                    className="text-[#5A5A5A] hover:text-[#1F1F1F]"
                    onClick={handleBackToDialPad}
                    disabled={loading}
                  >
                    ← Change Phone Number
                  </Button>
                </div>
              </form>
            ) : (
              /* Password Input View */
              <form onSubmit={handleLogin}>
                <div className="flex flex-col gap-5">
                  {/* First-time Login Notice */}
                  {memberInfo && !memberInfo.has_password && (
                    <div className="bg-[#E8F5E9] border-2 border-[#4CAF50] rounded-xl p-4 text-center">
                      <p className="text-[#2C5F2D] font-medium mb-2">
                        First time logging in?
                      </p>
                      <p className="text-[#2C5F2D] text-sm mb-3">
                        It looks like you haven't logged in yet. Please request a one-time password to get started.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        className="bg-[#4CAF50] text-white hover:bg-[#388E3C] w-full"
                        onClick={handleRequestOTP}
                        disabled={loading}
                      >
                        {loading ? 'Sending...' : 'Request One-Time Password'}
                      </Button>
                    </div>
                  )}

                  {/* Password Input */}
                  {memberInfo && memberInfo.has_password && (
                    <div>
                      <Label htmlFor="password" className="text-[#2C2C2C] font-medium">
                        Password *
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        required
                        autoFocus
                        className="h-12 border-[#DAD7D0] focus:border-[#A59480] focus:ring-[#A59480]"
                      />
                    </div>
                  )}

                  {/* Access Button */}
                  {memberInfo && memberInfo.has_password && (
                    <Button
                      type="submit"
                      size="lg"
                      className="bg-[#A59480] text-white hover:bg-[#8f7e6b] transition-all hover:-translate-y-0.5 active:translate-y-0 mt-2"
                      disabled={loading}
                    >
                      {loading ? 'Accessing...' : 'Access'}
                    </Button>
                  )}

                  {/* Alternative Sign-In Options */}
                  {memberInfo && (
                    <div className="space-y-3 pt-2">
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-[#ECEAE5]"></div>
                        </div>
                        <div className="relative flex justify-center text-xs">
                          <span className="bg-white px-2 text-[#8C7C6D]">Or sign in with</span>
                        </div>
                      </div>

                      {/* OTP Option */}
                      <Button
                        type="button"
                        size="lg"
                        variant="outline"
                        className="w-full border-2 border-[#A59480] text-[#A59480] hover:bg-[#A59480] hover:text-white transition-all hover:-translate-y-0.5 active:translate-y-0"
                        disabled={loading}
                        onClick={handleRequestOTP}
                      >
                        {loading ? 'Sending code...' : 'One-Time Password'}
                      </Button>

                      {/* Biometric Option */}
                      {FEATURES.BIOMETRIC_AUTH && biometricAvailable && (
                        <Button
                          type="button"
                          size="lg"
                          variant="outline"
                          className="w-full border-2 border-[#A59480] text-[#A59480] hover:bg-[#A59480] hover:text-white transition-all hover:-translate-y-0.5 active:translate-y-0"
                          disabled={loading}
                          onClick={handleBiometricLogin}
                        >
                          <Fingerprint className="w-5 h-5 mr-2" />
                          {loading ? 'Authenticating...' : 'Face ID / Touch ID'}
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Back to Dial Pad */}
                  <Button
                    type="button"
                    size="lg"
                    variant="ghost"
                    className="text-[#5A5A5A] hover:text-[#1F1F1F]"
                    onClick={handleBackToDialPad}
                    disabled={loading}
                  >
                    ← Change Phone Number
                  </Button>

                  {/* Forgot Password */}
                  {memberInfo && memberInfo.has_password && (
                    <div className="text-center pt-2">
                      <Link
                        href="/member/forgot-password"
                        className="text-[#A59480] text-sm font-medium hover:underline"
                      >
                        Forgot your password?
                      </Link>
                    </div>
                  )}
                </div>
              </form>
            )}
          </div>

          {/* Footer */}
          <div className="flex flex-col gap-3">
            <p className="text-center text-xs text-[#8C7C6D]">
              Issues? Text us at 913.777.4488
            </p>
            <p className="text-center text-xs text-[#8C7C6D]">
              By signing in, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
