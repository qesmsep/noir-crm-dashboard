'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/useToast';
import { Copy, Check, Mail, MessageSquare, UserPlus, Gift } from 'lucide-react';

interface ReferralSectionProps {
  referralCode: string;
  referralCount: number;
  memberId: string;
}

export default function ReferralSection({ referralCode, referralCount, memberId }: ReferralSectionProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const referralLink = `${baseUrl}/refer/${referralCode}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast({
        title: 'Copied!',
        description: 'Referral link copied to clipboard',
        variant: 'success',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: 'Failed to copy',
        description: 'Please try again',
        variant: 'error',
      });
    }
  };

  const shareViaText = () => {
    const message = encodeURIComponent(
      `I'd love for you to join me at Noir! Use my referral link to apply for membership: ${referralLink}`
    );
    window.open(`sms:?&body=${message}`, '_blank');
  };

  const shareViaEmail = () => {
    const subject = encodeURIComponent('Join me at Noir');
    const body = encodeURIComponent(
      `I'm a member at Noir and think you'd love it here!\n\nUse my personal referral link to apply for membership:\n${referralLink}\n\nLooking forward to seeing you at Noir!`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <Card className="bg-white rounded-2xl border border-[#ECEAE5] shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <UserPlus className="w-5 h-5 text-[#A59480] flex-shrink-0" />
            <CardTitle className="text-lg md:text-xl font-semibold text-[#1F1F1F] truncate">
              Refer Friends
            </CardTitle>
          </div>
          <Badge className="bg-[#A59480] text-white px-3 py-1 text-sm flex-shrink-0">
            {referralCount} {referralCount === 1 ? 'Referral' : 'Referrals'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Description */}
        <div className="space-y-3">
          <p className="text-sm text-[#2C2C2C]">
            Share Noir with friends and help grow our community. Your personal referral link makes
            it easy for them to apply for membership.
          </p>

          {referralCount > 0 && (
            <div className="bg-[#FFF9F0] border border-[#A59480] rounded-lg p-3 flex items-start gap-2">
              <Gift className="w-5 h-5 text-[#A59480] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[#2C2C2C]">
                You've successfully referred <strong>{referralCount}</strong>{' '}
                {referralCount === 1 ? 'member' : 'members'}! Thank you for growing the Noir community.
              </p>
            </div>
          )}
        </div>

        <div className="h-px bg-[#ECEAE5]" />

        {/* Referral Link */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-[#8C7C6D] uppercase tracking-wider">
              Your Referral Link
            </label>
          </div>
          <div className="flex gap-2">
            <Input
              value={referralLink}
              readOnly
              className="flex-1 bg-[#F6F5F2] border-[#DAD7D0] text-[#1F1F1F] text-sm font-mono"
            />
            <Button
              size="sm"
              variant="outline"
              className="border-[#A59480] text-[#A59480] hover:bg-[#A59480] hover:text-white flex-shrink-0"
              onClick={copyToClipboard}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-[#8C7C6D]">
            Your unique code: <strong className="text-[#1F1F1F]">{referralCode}</strong>
          </p>
        </div>

        {/* Share Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="w-full border-[#DAD7D0] text-[#2C2C2C] hover:border-[#A59480] hover:text-[#A59480]"
            onClick={shareViaText}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Share via Text
          </Button>
          <Button
            variant="outline"
            className="w-full border-[#DAD7D0] text-[#2C2C2C] hover:border-[#A59480] hover:text-[#A59480]"
            onClick={shareViaEmail}
          >
            <Mail className="w-4 h-4 mr-2" />
            Share via Email
          </Button>
        </div>

        {/* How it Works */}
        <div className="bg-[#FBFBFA] border border-[#ECEAE5] rounded-lg p-4 space-y-3">
          <p className="text-xs font-medium text-[#A59480] uppercase tracking-wider">
            How It Works
          </p>
          <div className="space-y-2">
            <div className="flex gap-3 text-sm">
              <span className="text-[#A59480] font-bold flex-shrink-0">1.</span>
              <span className="text-[#2C2C2C]">Share your unique referral link with friends</span>
            </div>
            <div className="flex gap-3 text-sm">
              <span className="text-[#A59480] font-bold flex-shrink-0">2.</span>
              <span className="text-[#2C2C2C]">They complete the application using your link</span>
            </div>
            <div className="flex gap-3 text-sm">
              <span className="text-[#A59480] font-bold flex-shrink-0">3.</span>
              <span className="text-[#2C2C2C]">Their application is marked with your referral</span>
            </div>
            <div className="flex gap-3 text-sm">
              <span className="text-[#A59480] font-bold flex-shrink-0">4.</span>
              <span className="text-[#2C2C2C]">
                Once they become a member, your referral count increases
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
