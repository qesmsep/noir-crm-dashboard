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
import { Fingerprint, CheckCircle2, Shield } from 'lucide-react';
import { useMemberAuth } from '@/context/MemberAuthContext';
import { useToast } from '@/hooks/useToast';

const DISMISSED_KEY = 'noir_biometric_prompt_dismissed';

interface BiometricRegistrationPromptProps {
  memberId: string;
}

export default function BiometricRegistrationPrompt({ memberId }: BiometricRegistrationPromptProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [success, setSuccess] = useState(false);
  const { registerBiometric, isBiometricAvailable } = useMemberAuth();
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;

    const checkShouldPrompt = async () => {
      // Check if user previously dismissed the prompt
      const dismissed = localStorage.getItem(DISMISSED_KEY);
      if (dismissed === memberId) return;

      // Check if device supports biometrics
      const available = await isBiometricAvailable();
      if (!available || cancelled) return;

      // Check if member already has biometric credentials registered
      try {
        const response = await fetch('/api/member/biometric-devices', {
          credentials: 'include',
        });

        if (!response.ok || cancelled) return;

        const data = await response.json();
        const devices = data.devices || [];

        // Only show prompt if no biometric credentials exist
        if (devices.length === 0 && !cancelled) {
          setIsOpen(true);
        }
      } catch {
        // Silently fail — don't block the dashboard
      }
    };

    // Delay slightly so dashboard loads first
    const timer = setTimeout(checkShouldPrompt, 1500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [memberId, isBiometricAvailable]);

  const handleSetup = async () => {
    setRegistering(true);

    try {
      const deviceName = `${navigator.platform} - ${new Date().toLocaleDateString()}`;
      await registerBiometric(deviceName);

      setSuccess(true);
      toast({
        title: 'Biometric registered',
        description: 'You can now use Face ID / Touch ID to sign in.',
        variant: 'success',
      });

      // Auto-close after showing success
      setTimeout(() => {
        setIsOpen(false);
        setSuccess(false);
      }, 2000);
    } catch (error: any) {
      // User cancelled or registration failed
      if (error.message?.includes('cancelled')) {
        // User cancelled the browser prompt — keep dialog open
        toast({
          title: 'Setup cancelled',
          description: 'You can try again or set this up later in Settings.',
          variant: 'warning',
        });
      } else {
        toast({
          title: 'Setup failed',
          description: error.message || 'Please try again later in Settings.',
          variant: 'error',
        });
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleDismiss = () => {
    setIsOpen(false);
  };

  const handleDontAskAgain = () => {
    localStorage.setItem(DISMISSED_KEY, memberId);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleDismiss(); }}>
      <DialogContent className="max-w-sm bg-white">
        {success ? (
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle2 className="h-16 w-16 text-[#4CAF50] mb-4" />
            <h3 className="text-xl font-semibold text-[#1F1F1F] mb-2">You're all set!</h3>
            <p className="text-sm text-[#5A5A5A] text-center">
              Next time, just use Face ID or Touch ID to sign in.
            </p>
          </div>
        ) : (
          <>
            <DialogHeader className="items-center text-center">
              <div className="mx-auto mb-2 w-16 h-16 rounded-full bg-[#F6F5F2] flex items-center justify-center">
                <Fingerprint className="w-8 h-8 text-[#A59480]" />
              </div>
              <DialogTitle className="text-xl font-semibold text-[#1F1F1F]">
                Enable Quick Sign-In
              </DialogTitle>
              <DialogDescription className="text-sm text-[#5A5A5A] pt-1">
                Use Face ID or Touch ID to sign in instantly — no password needed.
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-start gap-3 bg-[#F6F5F2] rounded-xl p-3 mt-1">
              <Shield className="w-4 h-4 text-[#A59480] mt-0.5 flex-shrink-0" />
              <p className="text-sm text-[#5A5A5A]">
                Your biometric data stays on your device and is never stored on our servers.
              </p>
            </div>

            <div className="flex flex-col gap-4 mt-2">
              <Button
                onClick={handleSetup}
                disabled={registering}
                className="w-full h-12 bg-[#A59480] text-white hover:bg-[#8f7e6b] transition-all hover:-translate-y-0.5 active:translate-y-0 text-base shadow-[0_2px_4px_rgba(0,0,0,0.1),0_4px_8px_rgba(0,0,0,0.08),0_8px_16px_rgba(0,0,0,0.06)]"
              >
                <Fingerprint className="w-5 h-5 mr-2" />
                {registering ? 'Setting up...' : 'Set Up Face ID / Touch ID'}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={handleDismiss}
                disabled={registering}
                className="w-full h-12 text-[#5A5A5A] hover:text-[#1F1F1F]"
              >
                Maybe Later
              </Button>

              <button
                type="button"
                onClick={handleDontAskAgain}
                disabled={registering}
                className="text-sm text-[#8C7C6D] hover:text-[#5A5A5A] transition-colors min-h-[44px]"
              >
                Don't ask again
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
