"use client";

import React, { useState } from 'react';
import { useMemberAuth } from '@/context/MemberAuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/useToast';

export default function MemberLoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

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
              Member Portal
            </h1>
            <p className="mt-2 text-[#5A5A5A] text-sm">
              Sign in with your phone number
            </p>
          </div>

          {/* Login Card */}
          <div className="bg-white rounded-2xl border border-[#ECEAE5] shadow-sm p-6 md:p-8">
            <form onSubmit={handleLogin}>
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
                    className="h-12 border-[#DAD7D0] focus:border-[#A59480] focus:ring-[#A59480]"
                  />
                </div>

                {biometricAvailable && phone && (
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    className="border-[#A59480] text-[#A59480] hover:bg-[#A59480] hover:text-white transition-all hover:-translate-y-0.5 active:translate-y-0"
                    disabled={loading}
                    onClick={handleBiometricLogin}
                  >
                    <span className="text-xl mr-2">👤</span>
                    {loading ? 'Authenticating...' : 'Sign In with Face ID / Touch ID'}
                  </Button>
                )}

                <Button
                  type="submit"
                  size="lg"
                  className="bg-[#A59480] text-white hover:bg-[#8f7e6b] transition-all hover:-translate-y-0.5 active:translate-y-0 mt-2"
                  disabled={loading}
                >
                  {loading ? 'Signing in...' : 'Sign In with Password'}
                </Button>

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
          </div>

          {/* Footer */}
          <div className="flex flex-col gap-3">
            <p className="text-center text-xs text-[#8C7C6D]">
              Need help? Contact us at support@noir.com
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
