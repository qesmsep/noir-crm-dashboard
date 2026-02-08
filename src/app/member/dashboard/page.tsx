"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Calendar, Clock, Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import MemberNav from '@/components/member/MemberNav';
import { useMemberAuth } from '@/context/MemberAuthContext';
import { Modal, ModalOverlay, ModalContent, ModalBody, ModalCloseButton } from '@chakra-ui/react';
import ReservationForm from '@/components/ReservationForm';
import { getSupabaseClient } from '@/pages/api/supabaseClient';

export default function MemberDashboardPage() {
  const router = useRouter();
  const { member, loading } = useMemberAuth();
  const [nextReservation, setNextReservation] = useState<any>(null);
  const [loadingReservation, setLoadingReservation] = useState(true);
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [baseDays, setBaseDays] = useState<number[]>([]);
  const [bookingStartDate, setBookingStartDate] = useState<Date | undefined>(undefined);
  const [bookingEndDate, setBookingEndDate] = useState<Date | undefined>(undefined);
  const [currentBalance, setCurrentBalance] = useState<number>(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch booking configuration (baseDays, booking window) - EXACT COPY FROM LANDING PAGE
  useEffect(() => {
    async function fetchConfig() {
      const supabase = getSupabaseClient();
      const { data: settingsData } = await supabase
        .from('settings')
        .select('booking_start_date, booking_end_date')
        .single();
      const { data: baseData } = await supabase
        .from('venue_hours')
        .select('day_of_week')
        .eq('type', 'base')
        .gte('time_ranges', '[]');

      setBookingStartDate(settingsData && settingsData.booking_start_date ? new Date(settingsData.booking_start_date) : new Date());
      setBookingEndDate(settingsData && settingsData.booking_end_date ? new Date(settingsData.booking_end_date) : (() => { const d = new Date(); d.setDate(d.getDate() + 60); return d; })());
      setBaseDays(Array.isArray(baseData) ? baseData.map(r => typeof r.day_of_week === 'string' ? Number(r.day_of_week) : r.day_of_week) : []);
    }
    fetchConfig();
  }, []);

  // Handle authentication redirects
  useEffect(() => {
    if (loading) return;

    if (!member) {
      router.push('/member/login');
      return;
    }

    if (member.password_is_temporary) {
      router.push('/member/change-password');
      return;
    }
  }, [member, loading, router]);

  // Fetch next upcoming reservation and current balance
  useEffect(() => {
    if (!member) return;

    fetchNextReservation();
    fetchCurrentBalance();
  }, [member]);

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

  const fetchCurrentBalance = async () => {
    try {
      const response = await fetch('/api/member/transactions', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const transactions = data.transactions || [];
        if (transactions.length > 0) {
          setCurrentBalance(parseFloat(transactions[0].running_balance || 0));
        }
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  };

  const handleReservationCreated = useCallback(() => {
    // Refresh the next reservation after creating a new one
    fetchNextReservation();
  }, []);

  const handleBookClick = useCallback(() => {
    setIsReservationModalOpen(true);
  }, []);

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#ECEDE8]">
        <Spinner size="xl" className="text-[#A59480]" />
      </div>
    );
  }

  if (!member) {
    return null;
  }

  if (member.password_is_temporary) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#ECEDE8] pb-20">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
        <div className="flex flex-col gap-6">
          {/* Welcome Header */}
          <div>
            <h1 className="text-3xl md:text-4xl text-[#1F1F1F] mb-2" style={{ fontFamily: 'CONEBARS' }}>
              Welcome back, {member.first_name}
            </h1>
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
                      onClick={() => setIsReservationModalOpen(true)}
                    >
                      Make Reservation
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Balance Card */}
            <Card className="bg-white rounded-2xl border border-[#ECEAE5] shadow-sm">
              <CardContent className="pt-5 pb-4 space-y-3">
                {/* Balance Display */}
                <div>
                  <p className="text-xs text-[#8C7C6D] mb-1">Account Balance</p>
                  <p
                    className={`text-xl font-semibold ${
                      currentBalance >= 0 ? 'text-[#4CAF50]' : 'text-[#F44336]'
                    }`}
                  >
                    ${Math.abs(currentBalance).toFixed(2)}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  {currentBalance < 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-[#A59480] text-[#A59480] hover:bg-[#A59480] hover:text-white text-xs h-8"
                      onClick={() => router.push('/member/balance')}
                    >
                      Pay Now
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`${currentBalance < 0 ? 'flex-1' : 'w-full'} text-[#8C7C6D] hover:bg-[#F6F5F2] hover:text-[#A59480] text-xs h-8`}
                    onClick={() => router.push('/member/balance')}
                  >
                    View Details →
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <MemberNav onBookClick={handleBookClick} />

      {/* Reservation Modal */}
      <Modal
        isOpen={isReservationModalOpen}
        onClose={() => setIsReservationModalOpen(false)}
        size="md"
        isCentered
      >
        <ModalOverlay bg="blackAlpha.700" />
        <ModalContent
          bg="white"
          borderRadius="2xl"
          boxShadow="2xl"
          maxW="500px"
          mx={4}
        >
          <ModalCloseButton zIndex={10} top={2} right={2} />
          <ModalBody p={{ base: 4, sm: 6, md: 8 }} pt={{ base: 16, sm: 16, md: 16 }}>
            <ReservationForm
              isMember={true}
              baseDays={baseDays}
              bookingStartDate={bookingStartDate}
              bookingEndDate={bookingEndDate}
              memberData={member ? {
                phone: member.phone,
                email: member.email,
                first_name: member.first_name,
                last_name: member.last_name,
              } : undefined}
              onClose={() => {
                setIsReservationModalOpen(false);
                handleReservationCreated();
              }}
            />
          </ModalBody>
        </ModalContent>
      </Modal>
    </div>
  );
}
