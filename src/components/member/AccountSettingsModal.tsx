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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/useToast';
import { Shield, Bell, Lock, LogOut, Key, Smartphone, Mail } from 'lucide-react';
import { useMemberAuth } from '@/context/MemberAuthContext';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/pages/api/supabaseClient';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AccountSettingsModal({ isOpen, onClose }: AccountSettingsModalProps) {
  const { member, signOut } = useMemberAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [supportPhone, setSupportPhone] = useState('913-777-4488');

  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    smsNotifications: false,
    reservationReminders: true,
    marketingEmails: false,
    twoFactorAuth: false,
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Fetch support phone from settings
  useEffect(() => {
    async function fetchSupportPhone() {
      try {
        const supabase = getSupabaseClient();
        const { data } = await supabase
          .from('settings')
          .select('support_phone')
          .single();

        if (data?.support_phone) {
          setSupportPhone(data.support_phone);
        }
      } catch (error) {
        // Use default if fetch fails
        console.error('Error fetching support phone:', error);
      }
    }

    if (isOpen) {
      fetchSupportPhone();
    }
  }, [isOpen]);

  const handlePreferenceChange = async (key: string, value: boolean) => {
    setPreferences({ ...preferences, [key]: value });

    // Save preference to backend
    try {
      const response = await fetch('/api/member/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [key]: value }),
      });

      if (!response.ok) {
        throw new Error('Failed to update preferences');
      }

      toast({
        title: 'Success',
        description: 'Preferences updated',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update preferences',
        variant: 'error',
      });
      // Revert the change
      setPreferences({ ...preferences, [key]: !value });
    }
  };

  const handlePasswordChange = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        variant: 'error',
      });
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      toast({
        title: 'Error',
        description: 'Password must be at least 8 characters',
        variant: 'error',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/member/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to change password');
      }

      toast({
        title: 'Success',
        description: 'Password changed successfully',
      });

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setShowPasswordForm(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to change password. Please check your current password.',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/member/login');
      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to logout',
        variant: 'error',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-[#1F1F1F]">
            Account Settings
          </DialogTitle>
          <DialogDescription className="text-sm text-[#5A5A5A] mt-1">
            Manage your account preferences and security settings
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {/* Security Settings */}
          <div className="bg-[#F6F5F2] rounded-xl p-6 border border-[#ECEAE5]">
            <h3 className="text-lg font-semibold text-[#1F1F1F] mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#A59480]" />
              Security Settings
            </h3>

            {!showPasswordForm ? (
              <div className="space-y-4">
                <Button
                  onClick={() => setShowPasswordForm(true)}
                  variant="outline"
                  className="w-full border-[#ECEAE5] text-[#1F1F1F] hover:bg-[#F6F5F2] justify-start"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Change Password
                </Button>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="twoFactorAuth" className="text-[#1F1F1F] font-medium">
                      Two-Factor Authentication
                    </Label>
                    <p className="text-sm text-[#5A5A5A]">Add an extra layer of security</p>
                  </div>
                  <Switch
                    id="twoFactorAuth"
                    checked={preferences.twoFactorAuth}
                    onCheckedChange={(checked) => handlePreferenceChange('twoFactorAuth', checked)}
                  />
                </div>

                <div className="pt-2 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-[#5A5A5A]">
                    <Key className="w-4 h-4" />
                    <span>Last password change: Never</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#5A5A5A]">
                    <Smartphone className="w-4 h-4" />
                    <span>Trusted devices: 1</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    className="mt-1 bg-white border-[#ECEAE5]"
                  />
                </div>

                <div>
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="mt-1 bg-white border-[#ECEAE5]"
                  />
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="mt-1 bg-white border-[#ECEAE5]"
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setPasswordForm({
                        currentPassword: '',
                        newPassword: '',
                        confirmPassword: '',
                      });
                    }}
                    disabled={loading}
                    className="flex-1 border-[#ECEAE5] text-[#5A5A5A] hover:bg-[#F6F5F2]"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handlePasswordChange}
                    disabled={loading}
                    className="flex-1 bg-[#A59480] text-white hover:bg-[#8C7C6D]"
                  >
                    {loading ? 'Changing...' : 'Change Password'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Account Actions */}
          <div className="bg-[#F6F5F2] rounded-xl p-6 border border-[#ECEAE5]">
            <h3 className="text-lg font-semibold text-[#1F1F1F] mb-4">Account Actions</h3>

            <div className="space-y-3">
              <Button
                onClick={handleLogout}
                variant="outline"
                className="w-full border-[#ECEAE5] text-[#F44336] hover:bg-red-50 justify-start"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>

              <div className="pt-4 border-t border-[#ECEAE5]">
                <p className="text-sm text-[#5A5A5A] mb-2">Need to deactivate your account?</p>
                <p className="text-xs text-[#8C7C6D]">
                  Please contact us by texting{' '}
                  <a href={`sms:${supportPhone}`} className="text-[#A59480] hover:underline font-medium">
                    {supportPhone}
                  </a>
                </p>
              </div>
            </div>
          </div>

          {/* Privacy Information */}
          <div className="text-xs text-[#8C7C6D] text-center">
            Your data is protected and encrypted. View our{' '}
            <a href="#" className="text-[#A59480] hover:underline">Privacy Policy</a>
            {' '}and{' '}
            <a href="#" className="text-[#A59480] hover:underline">Terms of Service</a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}