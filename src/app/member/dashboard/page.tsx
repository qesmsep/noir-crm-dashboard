"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Calendar, Clock, Wallet, User, List, ArrowUpIcon, ArrowDownIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import MemberNav from '@/components/member/MemberNav';
import { useMemberAuth } from '@/context/MemberAuthContext';
import { Modal, ModalOverlay, ModalContent, ModalBody, ModalCloseButton } from '@chakra-ui/react';
import ReservationForm from '@/components/ReservationForm';
import { getSupabaseClient } from '@/pages/api/supabaseClient';
import BalanceModal from '@/components/member/BalanceModal';
import ReservationsModal from '@/components/member/ReservationsModal';

export default function MemberDashboardPage() {
  const router = useRouter();
  const { member, loading } = useMemberAuth();
  const [nextReservation, setNextReservation] = useState<any>(null);
  const [loadingReservation, setLoadingReservation] = useState(true);
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
  const [isReservationsListModalOpen, setIsReservationsListModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [baseDays, setBaseDays] = useState<number[]>([]);
  const [bookingStartDate, setBookingStartDate] = useState<Date | undefined>(undefined);
  const [bookingEndDate, setBookingEndDate] = useState<Date | undefined>(undefined);
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [pastVisits, setPastVisits] = useState<any[]>([]);

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
      const response = await fetch('/api/member/reservations', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const reservations = data.reservations || [];
        const now = new Date();

        // Get next upcoming reservation
        const upcoming = reservations.filter(
          (r: any) => new Date(r.start_time) >= now && r.status !== 'cancelled'
        );
        setNextReservation(upcoming[0] || null);

        // Get last 2-3 past visits
        const past = reservations.filter(
          (r: any) => new Date(r.start_time) < now || r.status === 'cancelled'
        );
        setPastVisits(past.slice(0, 3));
      }
    } catch (error) {
      console.error('Error fetching reservations:', error);
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
          // Get last 3 transactions for preview
          setRecentTransactions(transactions.slice(0, 3));
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
    <div className="min-h-screen bg-[#ECEDE8] pb-20 relative">
      {/* Watermark Logo */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center z-0">
        <img
          src="/images/noir-wedding-day.png"
          alt=""
          aria-hidden="true"
          style={{ width: '520px', opacity: 0.08, userSelect: 'none', filter: 'invert(1)' }}
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6 lg:py-8">
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
                    Reservations
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingReservation ? (
                  <div className="flex justify-center py-8">
                    <Spinner className="text-[#A59480]" />
                  </div>
                ) : (
                  <>
                    {/* Next Reservation - One Line OR Make Reservation Button */}
                    {nextReservation ? (
                      <div>
                        <p className="text-xs text-[#8C7C6D] mb-2">Your Next Reservation</p>
                        <div
                          className="flex items-center justify-between gap-3 py-2 border-b border-[#ECEAE5] cursor-pointer hover:bg-[#FBFBFA]"
                          onClick={() => setIsReservationsListModalOpen(true)}
                        >
                          <p className="text-xs text-[#8C7C6D] flex-shrink-0">
                            {new Date(nextReservation.start_time).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                          <p className="text-xs font-medium text-[#1F1F1F] flex-1 truncate">
                            {new Date(nextReservation.start_time).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true,
                            })} • Party of {nextReservation.party_size}
                          </p>
                          <Badge className="text-xs px-2 py-0.5 bg-[#4CAF50] text-white">
                            {nextReservation.status}
                          </Badge>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs text-[#8C7C6D] mb-2">Your Next Reservation</p>
                        <Button
                          className="w-full bg-[#A59480] text-white hover:bg-[#8C7C6D]"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsReservationModalOpen(true);
                          }}
                        >
                          Make Reservation
                        </Button>
                      </div>
                    )}

                    {/* Past Visits Preview */}
                    {pastVisits.length > 0 && (
                      <div>
                        <p className="text-xs text-[#8C7C6D] mb-2">Recent Visits</p>
                        <div className="space-y-2">
                          {pastVisits.map((visit, index) => (
                            <div
                              key={visit.id || index}
                              className="flex items-center justify-between gap-3 py-2 border-b border-[#ECEAE5] last:border-0 cursor-pointer hover:bg-[#FBFBFA]"
                              onClick={() => setIsReservationsListModalOpen(true)}
                            >
                              <p className="text-xs text-[#8C7C6D] flex-shrink-0">
                                {new Date(visit.start_time).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </p>
                              <p className="text-xs text-[#5A5A5A] flex-1 truncate">
                                Party of {visit.party_size}
                              </p>
                              <Badge className="text-xs px-2 py-0.5 bg-[#DAD7D0] text-[#5A5A5A]">
                                {visit.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Balance Card */}
            <Card
              className="bg-white rounded-2xl border border-[#ECEAE5] shadow-sm cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setIsBalanceModalOpen(true)}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Wallet className="w-5 h-5 text-[#A59480]" />
                    <span className="text-xl font-semibold text-[#1F1F1F]">
                      Balance
                    </span>
                  </div>
                  <p
                    className={`text-xl font-bold ${
                      currentBalance >= 0 ? 'text-[#4CAF50]' : 'text-[#F44336]'
                    }`}
                  >
                    ${Math.abs(currentBalance).toFixed(2)}
                  </p>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Recent Transactions Preview */}
                {recentTransactions.length > 0 ? (
                  <div className="space-y-2">
                    {recentTransactions.map((transaction, index) => (
                      <div
                        key={transaction.id || index}
                        className="flex items-center justify-between gap-3 py-2 border-b border-[#ECEAE5] last:border-0"
                      >
                        <p className="text-xs text-[#8C7C6D] flex-shrink-0">
                          {new Date(transaction.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                        <p className="text-xs font-medium text-[#1F1F1F] truncate flex-1 min-w-0">
                          {transaction.description || 'Transaction'}
                        </p>
                        <p
                          className={`text-sm font-semibold flex-shrink-0 ${
                            transaction.transaction_type === 'credit' ? 'text-[#4CAF50]' : 'text-[#F44336]'
                          }`}
                        >
                          {transaction.transaction_type === 'credit' ? '+' : '-'}$
                          {Math.abs(parseFloat(transaction.amount)).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[#5A5A5A] text-center py-4">No recent transactions</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions Grid */}
          <div>
            <h2 className="text-lg font-semibold text-[#1F1F1F] mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Book Reservation */}
              <Card
                className="bg-white rounded-xl border border-[#ECEAE5] shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                onClick={handleBookClick}
              >
                <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                  <Calendar className="w-8 h-8 text-[#A59480] mb-2" />
                  <span className="text-sm font-medium text-[#1F1F1F]">Book</span>
                </CardContent>
              </Card>

              {/* Reservations */}
              <Card
                className="bg-white rounded-xl border border-[#ECEAE5] shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setIsReservationsListModalOpen(true)}
              >
                <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                  <List className="w-8 h-8 text-[#A59480] mb-2" />
                  <span className="text-sm font-medium text-[#1F1F1F]">Reservations</span>
                </CardContent>
              </Card>

              {/* Balance */}
              <Card
                className="bg-white rounded-xl border border-[#ECEAE5] shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setIsBalanceModalOpen(true)}
              >
                <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                  <Wallet className="w-8 h-8 text-[#A59480] mb-2" />
                  <span className="text-sm font-medium text-[#1F1F1F]">Balance</span>
                </CardContent>
              </Card>

              {/* Profile */}
              <Card
                className="bg-white rounded-xl border border-[#ECEAE5] shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push('/member/profile')}
              >
                <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                  <User className="w-8 h-8 text-[#A59480] mb-2" />
                  <span className="text-sm font-medium text-[#1F1F1F]">Profile</span>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <MemberNav
        onBookClick={handleBookClick}
        onBalanceClick={() => setIsBalanceModalOpen(true)}
        onReservationsClick={() => setIsReservationsListModalOpen(true)}
      />

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

      {/* Balance Modal */}
      <BalanceModal
        isOpen={isBalanceModalOpen}
        onClose={() => {
          setIsBalanceModalOpen(false);
          // Refresh balance after closing modal
          fetchCurrentBalance();
        }}
        accountId={member?.account_id}
        memberId={member?.member_id}
      />

      {/* Reservations List Modal */}
      <ReservationsModal
        isOpen={isReservationsListModalOpen}
        onClose={() => setIsReservationsListModalOpen(false)}
        onReservationUpdated={() => {
          fetchNextReservation();
        }}
        onMakeReservation={() => {
          setIsReservationModalOpen(true);
        }}
      />
    </div>
  );
}
