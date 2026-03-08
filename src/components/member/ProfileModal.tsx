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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/useToast';
import { User, Mail, Phone, Camera, Edit2, Save, X, Users, Cake, Lock, LogOut } from 'lucide-react';
import { useMemberAuth } from '@/context/MemberAuthContext';
import { useRouter } from 'next/navigation';
import PhotoCropUpload from '@/components/PhotoCropUpload';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AccountMember {
  member_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  photo?: string;
  photo_url?: string;
  profile_photo_url?: string;
  created_at: string;
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { member, refreshMember, signOut } = useMemberAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accountMembers, setAccountMembers] = useState<AccountMember[]>([]);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const [formData, setFormData] = useState({
    first_name: member?.first_name || '',
    last_name: member?.last_name || '',
    email: member?.email || '',
    phone: member?.phone || '',
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Fetch account members when modal opens
  useEffect(() => {
    if (isOpen && member) {
      fetchAccountMembers();
    }
  }, [isOpen, member]);

  const fetchAccountMembers = async () => {
    try {
      const response = await fetch('/api/member/account-members', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setAccountMembers(data.members || []);
      }
    } catch (error) {
      console.error('Error fetching account members:', error);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setFormData({
      first_name: member?.first_name || '',
      last_name: member?.last_name || '',
      email: member?.email || '',
      phone: member?.phone || '',
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({
      first_name: member?.first_name || '',
      last_name: member?.last_name || '',
      email: member?.email || '',
      phone: member?.phone || '',
    });
  };

  const handlePhotoSelected = async (photoDataUrl: string) => {
    setLoading(true);
    try {
      console.log('Uploading photo, data URL length:', photoDataUrl.length);

      const response = await fetch('/api/member/set-photo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ photo_url: photoDataUrl }),
      });

      const result = await response.json();
      console.log('Photo upload response:', result);

      if (!response.ok) {
        throw new Error(result.error || 'Failed to upload photo');
      }

      // Refresh the member data to show the new photo
      await refreshMember();

      toast({
        title: 'Success',
        description: 'Photo updated successfully',
      });

      // Exit edit mode to show the new photo
      setIsEditing(false);
    } catch (error: any) {
      console.error('Photo upload error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload photo',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/member/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          contact_preferences: member?.contact_preferences || {
            sms: true,
            email: true,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });

      setIsEditing(false);
      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update profile',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const getInitials = () => {
    const first = member?.first_name?.charAt(0) || '';
    const last = member?.last_name?.charAt(0) || '';
    return `${first}${last}`.toUpperCase();
  };

  const formatPhone = (phone?: string) => {
    if (!phone) return '';
    // Strip all non-digits and take last 10 digits (handles any prefix)
    const cleaned = phone.replace(/\D/g, '').slice(-10);

    if (cleaned.length === 10) {
      return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6, 10)}`;
    }

    // Progressive formatting for partial input
    const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
    if (match) {
      return !match[2] ? match[1] : `(${match[1]}) ${match[2]}${match[3] ? `-${match[3]}` : ''}`;
    }

    return phone;
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
            {member?.first_name}'s Profile
          </DialogTitle>
          <DialogDescription className="sr-only">
            View and edit your member profile information
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide">
          {/* Profile Photo Section */}
          <div className="flex flex-col items-center space-y-4 pb-0 pt-2 relative z-20">
            <div className="relative">
              <div className="w-40 h-40 border-4 border-[#ECEAE5] rounded-full overflow-hidden bg-[#A59480]">
                {(member?.photo || member?.profile_photo_url) ? (
                  <img src={(member.photo || member.profile_photo_url) ?? undefined} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white text-3xl font-bold">
                    {getInitials()}
                  </div>
                )}
              </div>
              {isEditing && (
                <PhotoCropUpload
                  onPhotoSelected={handlePhotoSelected}
                  currentPhoto={(member?.photo || member?.profile_photo_url) || undefined}
                  buttonClassName="absolute -bottom-1 right-0 bg-[#A59480] hover:bg-[#8C7C6D] text-white w-10 h-10 rounded-full transition-colors flex items-center justify-center"
                  showEditButton={true}
                />
              )}
            </div>
          </div>

          {/* Profile Information - Condensed */}
          <div className="bg-[#F6F5F2] rounded-xl p-3 border border-[#ECEAE5] -mt-4 relative z-10 shadow-lg">
            {/* Edit Icon - Only show when not editing */}
            {!isEditing && (
              <button
                onClick={handleEdit}
                className="absolute -bottom-2 -right-6 text-[#8C7C6D] hover:text-[#A59480] transition-colors z-20 bg-transparent border-0 outline-none focus:outline-none p-0"
                aria-label="Edit profile"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            )}

            {/* Cancel Icon - Top left when editing */}
            {isEditing && (
              <button
                onClick={handleCancel}
                disabled={loading}
                className="absolute -top-2 left-2 text-[#5A5A5A] hover:text-[#8C7C6D] transition-colors z-20 bg-transparent border-0 outline-none focus:outline-none p-0"
                aria-label="Cancel"
              >
                <X className="w-3 h-3" />
              </button>
            )}

            {/* Save Icon - Bottom right when editing */}
            {isEditing && (
              <button
                onClick={handleSave}
                disabled={loading}
                className="absolute -bottom-2 -right-6 text-[#A59480] hover:text-[#8C7C6D] transition-colors z-20 bg-transparent border-0 outline-none focus:outline-none p-0"
                aria-label="Save changes"
              >
                <Save className="w-3 h-3" />
              </button>
            )}
            {isEditing ? (
              <div className="space-y-2">
                {/* First and Last Name Row */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <User className="absolute left-2 top-2 w-3 h-3 text-[#8C7C6D]" />
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className="bg-white border-[#ECEAE5] pl-7 h-7 !text-xs focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[#A59480]"
                      placeholder="First name"
                    />
                  </div>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="bg-white border-[#ECEAE5] h-7 !text-xs focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[#A59480]"
                    placeholder="Last name"
                  />
                </div>

                {/* Email and Phone Row */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <Mail className="absolute left-2 top-2 w-3 h-3 text-[#8C7C6D]" />
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="bg-white border-[#ECEAE5] pl-7 h-7 !text-xs focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[#A59480]"
                      placeholder="Email address"
                    />
                  </div>
                  <div className="relative">
                    <Phone className="absolute left-2 top-2 w-3 h-3 text-[#8C7C6D]" />
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="bg-white border-[#ECEAE5] pl-7 h-7 !text-xs focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[#A59480]"
                      placeholder="Phone number"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Name and DOB Row */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3 h-3 text-[#8C7C6D] flex-shrink-0" />
                    <p className="text-xs text-[#1F1F1F] font-medium truncate">{member?.first_name} {member?.last_name}</p>
                  </div>
                  {(member as any)?.dob && (
                    <div className="flex items-center gap-1.5">
                      <Cake className="w-3 h-3 text-[#8C7C6D] flex-shrink-0" />
                      <p className="text-xs text-[#1F1F1F] truncate">
                        {(() => {
                          const [year, month, day] = (member as any).dob.split('-');
                          const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                          return date.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          });
                        })()}
                      </p>
                    </div>
                  )}
                </div>

                {/* Email and Phone Row */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3 h-3 text-[#8C7C6D] flex-shrink-0" />
                    <p className="text-xs text-[#1F1F1F] truncate">{member?.email}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-[#8C7C6D] flex-shrink-0" />
                    <p className="text-xs text-[#1F1F1F] truncate">{formatPhone(member?.phone)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Member Information */}
          <div className="bg-[#F6F5F2] rounded-xl p-3 border border-[#ECEAE5] space-y-2 mt-6 shadow-lg">
            <h3 className="text-sm font-semibold text-[#1F1F1F] mb-1">Membership Details</h3>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-[#5A5A5A] font-semibold">Membership</p>
                <p className="text-xs text-[#1F1F1F] font-medium">
                  {(member as any)?.subscription_name || (member as any)?.membership_type || 'Standard Membership'}
                </p>
              </div>

              <div>
                <p className="text-xs text-[#5A5A5A] font-semibold">Member Since</p>
                <p className="text-xs text-[#1F1F1F] font-medium">
                  {member?.created_at ? new Date(member.created_at).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric'
                  }) : 'N/A'}
                </p>
              </div>

              <div>
                <p className="text-xs text-[#5A5A5A] font-semibold">Status</p>
                <p className="text-xs text-[#4CAF50] font-medium">Active</p>
              </div>

              <div>
                <p className="text-xs text-[#5A5A5A] font-semibold">Next Renewal</p>
                <p className="text-xs text-[#1F1F1F] font-medium">
                  {(member as any)?.next_renewal_date ? new Date((member as any).next_renewal_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  }) : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Account Members */}
          {accountMembers.length > 1 && (
            <div className="bg-[#F6F5F2] rounded-xl p-3 border border-[#ECEAE5] mt-6 shadow-lg">
              <h3 className="text-sm font-semibold text-[#1F1F1F] mb-2 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#A59480]" />
                Other Account Members
              </h3>

              <div className="space-y-2">
                {accountMembers
                  .filter((m) => m.member_id !== member?.member_id)
                  .map((accountMember) => (
                    <div key={accountMember.member_id} className="flex items-center gap-2 p-2 bg-white rounded-lg">
                      <div className="w-10 h-10 bg-[#A59480] text-white rounded-full flex items-center justify-center text-xs font-medium overflow-hidden">
                        {accountMember.photo || accountMember.photo_url || accountMember.profile_photo_url ? (
                          <img
                            src={accountMember.photo || accountMember.photo_url || accountMember.profile_photo_url}
                            alt={`${accountMember.first_name} ${accountMember.last_name}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <>{accountMember.first_name?.charAt(0)}{accountMember.last_name?.charAt(0)}</>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[#1F1F1F] truncate">
                          {accountMember.first_name} {accountMember.last_name}
                        </p>
                        <p className="text-xs text-[#5A5A5A] truncate">{accountMember.email}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-[#8C7C6D]">{formatPhone(accountMember.phone)}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Security Settings */}
          <div className="bg-[#F6F5F2] rounded-xl p-3 border border-[#ECEAE5] mt-6 shadow-lg">
            <h3 className="text-sm font-semibold text-[#1F1F1F] mb-2 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-[#A59480]" />
              Security
            </h3>

            {!showPasswordForm ? (
              <div className="space-y-2">
                <Button
                  onClick={() => setShowPasswordForm(true)}
                  variant="outline"
                  className="w-full border-[#ECEAE5] text-[#1F1F1F] hover:bg-[#F6F5F2] justify-start h-8 text-xs"
                >
                  <Lock className="w-3 h-3 mr-2" />
                  Change Password
                </Button>

                <Button
                  onClick={handleLogout}
                  variant="outline"
                  className="w-full border-[#ECEAE5] text-[#F44336] hover:bg-red-50 justify-start h-8 text-xs"
                >
                  <LogOut className="w-3 h-3 mr-2" />
                  Sign Out
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div>
                  <Label htmlFor="currentPassword" className="text-xs">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    className="mt-1 bg-white border-[#ECEAE5] h-8 text-xs"
                  />
                </div>

                <div>
                  <Label htmlFor="newPassword" className="text-xs">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="mt-1 bg-white border-[#ECEAE5] h-8 text-xs"
                  />
                </div>

                <div>
                  <Label htmlFor="confirmPassword" className="text-xs">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="mt-1 bg-white border-[#ECEAE5] h-8 text-xs"
                  />
                </div>

                <div className="flex gap-2 pt-1">
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
                    className="flex-1 border-[#ECEAE5] text-[#5A5A5A] hover:bg-[#F6F5F2] h-8 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handlePasswordChange}
                    disabled={loading}
                    className="flex-1 bg-[#A59480] text-white hover:bg-[#8C7C6D] h-8 text-xs"
                  >
                    {loading ? 'Changing...' : 'Change Password'}
                  </Button>
                </div>
              </div>
            )}
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}