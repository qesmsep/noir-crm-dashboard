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

export default function MemberLoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [showPasswordInput, setShowPasswordInput] = useState(false);

  const { signInWithPassword, signInWithBiometric, isBiometricAvailable, member } = useMemberAuth();
  const { toast } = useToast();
  const router = useRouter();

  // Check biometric availability on mount
  React.useEffect(() => {
    isBiometricAvailable().then(setBiometricAvailable);
  }, [isBiometricAvailable]);

  // Redirect if already logged in
  React.useEffect(() => {
    if (member) {
      router.push('/member/dashboard');
    }
  }, [member, router]);

  // Handle dial pad "Call" button - show password input
  const handleCall = () => {
    setShowPasswordInput(true);
  };

  // Handle going back to dial pad
  const handleBackToDialPad = () => {
    setShowPasswordInput(false);
    setPassword('');
  };

  // Handle password login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const isTemporary = await signInWithPassword(phone, password);

      // If password is temporary, redirect to change password page
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
      router.push('/member/dashboard');
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
            />
            <p className="text-[#5A5A5A] text-sm">
              {showPasswordInput ? 'Enter your password' : 'Dial your phone number'}
            </p>
          </div>

          {/* Login Card */}
          <div className="bg-white rounded-2xl border border-[#ECEAE5] shadow-sm p-6 md:p-8">
            {!showPasswordInput ? (
              /* Phone Dial Pad View */
              <div className="flex flex-col gap-6">
                <PhoneDialPad
                  value={phone}
                  onChange={setPhone}
                  onCall={handleCall}
                />

                {/* Biometric Option */}
                {biometricAvailable && phone.length === 10 && (
                  <div className="pt-2">
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      className="w-full border-2 border-[#A59480] text-[#A59480] hover:bg-[#A59480] hover:text-white transition-all hover:-translate-y-0.5 active:translate-y-0"
                      disabled={loading}
                      onClick={handleBiometricLogin}
                    >
                      <Fingerprint className="w-5 h-5 mr-2" />
                      {loading ? 'Authenticating...' : 'Sign In with Face ID / Touch ID'}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              /* Password Input View */
              <form onSubmit={handleLogin}>
                <div className="flex flex-col gap-5">
                  {/* Password Input */}
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

                  {/* Biometric Alternative */}
                  {biometricAvailable && (
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      className="border-2 border-[#A59480] text-[#A59480] hover:bg-[#A59480] hover:text-white transition-all hover:-translate-y-0.5 active:translate-y-0"
                      disabled={loading}
                      onClick={handleBiometricLogin}
                    >
                      <Fingerprint className="w-5 h-5 mr-2" />
                      {loading ? 'Authenticating...' : 'Use Face ID / Touch ID Instead'}
                    </Button>
                  )}

                  {/* Access Button */}
                  <Button
                    type="submit"
                    size="lg"
                    className="bg-[#A59480] text-white hover:bg-[#8f7e6b] transition-all hover:-translate-y-0.5 active:translate-y-0 mt-2"
                    disabled={loading}
                  >
                    {loading ? 'Accessing...' : 'Access'}
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

                  {/* Forgot Password */}
                  <div className="text-center pt-2">
                    <Link
                      href="/member/forgot-password"
                      className="text-[#A59480] text-sm font-medium hover:underline"
                    >
                      Forgot your password?
                    </Link>
                  </div>
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
