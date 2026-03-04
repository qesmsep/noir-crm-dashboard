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
import { User, Mail, Phone, Camera, Edit2, Save, X, Users } from 'lucide-react';
import { useMemberAuth } from '@/context/MemberAuthContext';

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
  const { member } = useMemberAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accountMembers, setAccountMembers] = useState<AccountMember[]>([]);

  const [formData, setFormData] = useState({
    first_name: member?.first_name || '',
    last_name: member?.last_name || '',
    email: member?.email || '',
    phone: member?.phone || '',
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

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/member/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });

      setIsEditing(false);
      // Refresh member data
      window.location.reload();
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
    const cleaned = phone.replace(/\D/g, '').slice(-10);
    if (cleaned.length !== 10) return phone;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-[#1F1F1F]">
            Profile
          </DialogTitle>
          <DialogDescription className="text-sm text-[#5A5A5A] mt-1">
            Manage your personal information and profile photo
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {/* Profile Photo Section */}
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <div className="w-32 h-32 border-4 border-[#ECEAE5] rounded-full overflow-hidden bg-[#A59480]">
                {(member?.photo || member?.profile_photo_url) ? (
                  <img src={(member.photo || member.profile_photo_url) ?? undefined} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white text-3xl font-bold">
                    {getInitials()}
                  </div>
                )}
              </div>
              {isEditing && (
                <button className="absolute bottom-0 right-0 bg-[#A59480] hover:bg-[#8C7C6D] text-white p-2 rounded-full transition-colors">
                  <Camera className="w-4 h-4" />
                </button>
              )}
            </div>
            {!isEditing && (
              <p className="text-lg font-semibold text-[#1F1F1F]">
                {member?.first_name} {member?.last_name}
              </p>
            )}
          </div>

          {/* Profile Information - Condensed */}
          <div className="bg-[#F6F5F2] rounded-xl p-4 border border-[#ECEAE5]">
            {isEditing ? (
              <div className="space-y-3">
                {/* First and Last Name Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-4 h-4 text-[#8C7C6D]" />
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className="bg-white border-[#ECEAE5] pl-10"
                      placeholder="First name"
                    />
                  </div>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className="bg-white border-[#ECEAE5]"
                    placeholder="Last name"
                  />
                </div>

                {/* Email and Phone Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-[#8C7C6D]" />
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="bg-white border-[#ECEAE5] pl-10"
                      placeholder="Email address"
                    />
                  </div>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 w-4 h-4 text-[#8C7C6D]" />
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="bg-white border-[#ECEAE5] pl-10"
                      placeholder="Phone number"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* First and Last Name Row */}
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-[#8C7C6D]" />
                    <p className="text-[#1F1F1F] font-medium">{member?.first_name} {member?.last_name}</p>
                  </div>
                </div>

                {/* Email and Phone Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[#8C7C6D]" />
                    <p className="text-[#1F1F1F]">{member?.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-[#8C7C6D]" />
                    <p className="text-[#1F1F1F]">{formatPhone(member?.phone)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Member Information */}
          <div className="bg-[#F6F5F2] rounded-xl p-6 border border-[#ECEAE5] space-y-4">
            <h3 className="text-lg font-semibold text-[#1F1F1F] mb-2">Membership Details</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-[#5A5A5A]">Subscription</p>
                <p className="text-[#1F1F1F] font-medium">
                  {(member as any)?.subscription_name || (member as any)?.membership_type || 'Standard Membership'}
                </p>
              </div>

              <div>
                <p className="text-sm text-[#5A5A5A]">Member Since</p>
                <p className="text-[#1F1F1F] font-medium">
                  {member?.created_at ? new Date(member.created_at).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric'
                  }) : 'N/A'}
                </p>
              </div>

              <div>
                <p className="text-sm text-[#5A5A5A]">Status</p>
                <p className="text-[#4CAF50] font-medium">Active</p>
              </div>

              <div>
                <p className="text-sm text-[#5A5A5A]">Member ID</p>
                <p className="text-[#8C7C6D] text-xs font-medium">{member?.member_id?.slice(0, 8).toUpperCase()}</p>
              </div>
            </div>
          </div>

          {/* Account Members */}
          {accountMembers.length > 1 && (
            <div className="bg-[#F6F5F2] rounded-xl p-6 border border-[#ECEAE5]">
              <h3 className="text-lg font-semibold text-[#1F1F1F] mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-[#A59480]" />
                Other Account Members
              </h3>

              <div className="space-y-3">
                {accountMembers
                  .filter((m) => m.member_id !== member?.member_id)
                  .map((accountMember) => (
                    <div key={accountMember.member_id} className="flex items-center gap-3 p-3 bg-white rounded-lg">
                      <div className="w-12 h-12 bg-[#A59480] text-white rounded-full flex items-center justify-center font-medium overflow-hidden">
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
                      <div className="flex-1">
                        <p className="font-medium text-[#1F1F1F]">
                          {accountMember.first_name} {accountMember.last_name}
                        </p>
                        <p className="text-xs text-[#5A5A5A]">{accountMember.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[#8C7C6D]">{formatPhone(accountMember.phone)}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            {isEditing ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={loading}
                  className="border-[#ECEAE5] text-[#5A5A5A] hover:bg-[#F6F5F2]"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={loading}
                  className="bg-[#A59480] text-white hover:bg-[#8C7C6D]"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </>
            ) : (
              <Button
                onClick={handleEdit}
                className="bg-[#A59480] text-white hover:bg-[#8C7C6D]"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}