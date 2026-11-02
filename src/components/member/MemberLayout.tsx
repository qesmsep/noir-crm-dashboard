"use client";

import React from 'react';
import { useMemberAuth } from '@/context/MemberAuthContext';
import { useRouter, usePathname } from 'next/navigation';
import MemberNav from './MemberNav';

interface MemberLayoutProps {
  children: React.ReactNode;
  showNav?: boolean;
}

export default function MemberLayout({ children, showNav = true }: MemberLayoutProps) {
  const { member, loading } = useMemberAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Redirect to login if not authenticated (after loading)
  React.useEffect(() => {
    if (!loading && !member) {
      // Bring the member back to this page after they sign in
      const next = pathname && pathname !== '/member/dashboard' ? `?next=${encodeURIComponent(pathname)}` : '';
      router.push(`/member/login${next}`);
    }
  }, [loading, member, router, pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#ECEDE8]">
        <div className="text-[#A59480]">Loading...</div>
      </div>
    );
  }

  if (!member) {
    return null; // Will redirect
  }

  return (
    <div
      className="min-h-screen bg-[#ECEDE8]"
      style={{ paddingBottom: showNav ? '80px' : '0' }}
    >
      {/* Header */}
      <div className="bg-white border-b border-[#ECEAE5] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            {/* Logo */}
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
      <div className="max-w-7xl mx-auto px-4 py-4 md:py-6 lg:py-8">
        {children}
      </div>

      {/* Bottom Navigation */}
      {showNav && <MemberNav />}
    </div>
  );
}
