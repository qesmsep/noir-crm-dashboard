"use client";

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Calendar, Clock, Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import MemberNav from '@/components/member/MemberNav';
import { useMemberAuth } from '@/context/MemberAuthContext';

export default function MemberDashboardPage() {
  const router = useRouter();
  const { member, loading } = useMemberAuth();
  const [nextReservation, setNextReservation] = useState<any>(null);
  const [loadingReservation, setLoadingReservation] = useState(true);

  // Fetch next upcoming reservation
  useEffect(() => {
    if (!member) return;

    const fetchNextReservation = async () => {
      try {
        const response = await fetch('/api/member/next-reservation', {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setNextReservation(data.reservation);
        }
      } catch (error) {
        console.error('Error fetching next reservation:', error);
      } finally {
        setLoadingReservation(false);
      }
    };

    fetchNextReservation();
  }, [member]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#ECEDE8]">
        <Spinner size="xl" className="text-[#A59480]" />
      </div>
    );
  }

  if (!member) {
    router.push('/member/login');
    return null;
  }

  // Redirect to change password if using temporary password
  if (member.password_is_temporary) {
    router.push('/member/change-password');
    return null;
  }

  return (
    <div className="min-h-screen bg-[#ECEDE8] pb-20">
      {/* Header */}
      <div className="bg-white border-b border-[#ECEAE5] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <img
              src="/images/noir-wedding-day.png"
              alt="Noir"
              className="h-8 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
        <div className="flex flex-col gap-6">
          {/* Welcome Header */}
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-[#1F1F1F] mb-2">
              Welcome back, {member.first_name}
            </h1>
            <p className="text-[#5A5A5A]">
              {member.membership} Member
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Next Reservation Card */}
            <Card className="bg-white rounded-2xl border border-[#ECEAE5] shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-[#A59480]" />
                  <span className="text-xl font-semibold text-[#1F1F1F]">
                    Next Reservation
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingReservation ? (
                  <div className="flex justify-center py-8">
                    <Spinner className="text-[#A59480]" />
                  </div>
                ) : nextReservation ? (
                  <div className="flex flex-col gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-[#5A5A5A]" />
                        <p className="text-lg font-medium text-[#1F1F1F]">
                          {new Date(nextReservation.start_time).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })} • {new Date(nextReservation.start_time).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 mt-3 flex-wrap">
                        <p className="text-sm text-[#5A5A5A]">
                          Party of <strong>{nextReservation.party_size}</strong>
                        </p>
                        {nextReservation.table_number && (
                          <p className="text-sm text-[#5A5A5A]">
                            Table <strong>{nextReservation.table_number}</strong>
                          </p>
                        )}
                        <Badge className="bg-[#A59480] text-white px-2 py-1 text-xs capitalize">
                          {nextReservation.status}
                        </Badge>
                      </div>
                      {nextReservation.notes && (
                        <p className="text-sm text-[#5A5A5A] mt-3">
                          {nextReservation.notes}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      className="border-[#A59480] text-[#A59480] hover:bg-[#A59480] hover:text-white"
                      onClick={() => router.push('/member/reservations')}
                    >
                      View All Reservations
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <p className="text-[#5A5A5A] text-center py-4">
                      No upcoming reservations
                    </p>
                    <Button
                      className="bg-[#A59480] text-white hover:bg-[#8C7C6D]"
                      onClick={() => router.push('/member/book')}
                    >
                      Book a Table
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Balance Card */}
            <Card className="bg-white rounded-2xl border border-[#ECEAE5] shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Wallet className="w-5 h-5 text-[#A59480]" />
                  <span className="text-xl font-semibold text-[#1F1F1F]">
                    Account Balance
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  <div>
                    <p
                      className={`text-3xl font-bold ${
                        (member.balance ?? 0) >= 0 ? 'text-[#4CAF50]' : 'text-[#F44336]'
                      }`}
                    >
                      ${(member.balance ?? 0).toFixed(2)}
                    </p>
                    <p className="text-sm text-[#5A5A5A]">
                      {(member.balance ?? 0) >= 0 ? 'Credit' : 'Balance Due'}
                    </p>
                  </div>

                  <div className="bg-[#F6F5F2] p-3 rounded-lg">
                    <p className="text-sm text-[#5A5A5A] mb-1">
                      Monthly Credit
                    </p>
                    <p className="text-lg font-medium text-[#1F1F1F]">
                      ${(member.monthly_credit || 0).toFixed(2)}
                    </p>
                    {member.credit_renewal_date && (
                      <p className="text-xs text-[#8C7C6D] mt-1">
                        Renews {new Date(member.credit_renewal_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    className="text-[#A59480] hover:bg-gray-100"
                    onClick={() => router.push('/member/balance')}
                  >
                    View Transaction History
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card className="bg-white rounded-2xl border border-[#ECEAE5] shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-[#1F1F1F]">
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-[#DAD7D0] text-[#2C2C2C] hover:border-[#A59480] hover:text-[#A59480] hover:bg-transparent"
                  onClick={() => router.push('/member/book')}
                >
                  Book Table
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-[#DAD7D0] text-[#2C2C2C] hover:border-[#A59480] hover:text-[#A59480] hover:bg-transparent"
                  onClick={() => router.push('/member/reservations')}
                >
                  My Reservations
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-[#DAD7D0] text-[#2C2C2C] hover:border-[#A59480] hover:text-[#A59480] hover:bg-transparent"
                  onClick={() => router.push('/member/balance')}
                >
                  Pay Balance
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-[#DAD7D0] text-[#2C2C2C] hover:border-[#A59480] hover:text-[#A59480] hover:bg-transparent"
                  onClick={() => router.push('/member/profile')}
                >
                  My Profile
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
