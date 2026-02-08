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

  // Fetch next upcoming reservation
  useEffect(() => {
    if (!member) return;

    fetchNextReservation();
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
            <Card className="bg-white rounded-2xl border border-[#ECEAE5] shadow-sm overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-[#A59480]" />
                  <span className="text-base font-semibold text-[#1F1F1F]" style={{ fontFamily: 'Montserrat' }}>
                    Account Balance
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Main Balance */}
                <div className="text-center py-2">
                  <p
                    className={`text-3xl font-bold mb-0.5 ${
                      (member.balance ?? 0) >= 0 ? 'text-[#4CAF50]' : 'text-[#F44336]'
                    }`}
                    style={{ fontFamily: 'Montserrat' }}
                  >
                    ${(member.balance ?? 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-[#8C7C6D] uppercase tracking-wider" style={{ fontFamily: 'Montserrat', fontWeight: 300 }}>
                    {(member.balance ?? 0) >= 0 ? 'Credit' : 'Balance Due'}
                  </p>
                </div>

                {/* Divider */}
                <div className="border-t border-[#ECEAE5]"></div>

                {/* Monthly Credit */}
                <div className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-xs text-[#8C7C6D] uppercase tracking-wider mb-0.5" style={{ fontFamily: 'Montserrat', fontWeight: 300 }}>
                      Monthly Credit
                    </p>
                    <p className="text-lg font-bold text-[#1F1F1F]" style={{ fontFamily: 'Montserrat' }}>
                      ${(member.monthly_credit || 0).toFixed(2)}
                    </p>
                  </div>
                  {member.credit_renewal_date && (
                    <div className="text-right">
                      <p className="text-xs text-[#8C7C6D] uppercase tracking-wider mb-0.5" style={{ fontFamily: 'Montserrat', fontWeight: 300 }}>
                        Renews
                      </p>
                      <p className="text-xs font-medium text-[#2C2C2C]" style={{ fontFamily: 'Montserrat' }}>
                        {new Date(member.credit_renewal_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-[#A59480] text-[#A59480] hover:bg-[#A59480] hover:text-white transition-colors text-xs"
                    onClick={() => router.push('/member/balance')}
                    style={{ fontFamily: 'Montserrat', fontWeight: 500 }}
                  >
                    Pay Balance
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-[#A59480] hover:bg-[#F6F5F2] transition-colors text-xs"
                    onClick={() => router.push('/member/balance')}
                    style={{ fontFamily: 'Montserrat', fontWeight: 300 }}
                  >
                    View Transaction History
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
