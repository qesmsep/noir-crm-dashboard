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
import { LogOut } from 'lucide-react';

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
          <Card className="bg-white rounded-2xl border border-[#ECEAE5] shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14 bg-[#A59480]">
                    <AvatarImage src={member.profile_photo_url || undefined} />
                    <AvatarFallback className="bg-[#A59480] text-white">
                      {member.first_name[0]}{member.last_name[0]}
                    </AvatarFallback>
                  </Avatar>
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
                    className="border-[#A59480] text-[#A59480] hover:bg-[#A59480] hover:text-white"
                    onClick={() => setEditing(true)}
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

          {/* Account Settings Card */}
          <Card className="bg-white rounded-2xl border border-[#ECEAE5] shadow-sm">
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
