"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Calendar, Clock, Wallet, User, List, ArrowUpIcon, ArrowDownIcon, CreditCard, CalendarDays, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemberAuth } from '@/context/MemberAuthContext';
import { Modal, ModalOverlay, ModalContent, ModalBody, ModalCloseButton } from '@chakra-ui/react';
import ReservationForm from '@/components/ReservationForm';
import { getSupabaseClient } from '@/pages/api/supabaseClient';
import BalanceModal from '@/components/member/BalanceModal';
import ReservationsModal from '@/components/member/ReservationsModal';
import ProfileModal from '@/components/member/ProfileModal';
import SubscriptionModal from '@/components/member/SubscriptionModal';
import UpcomingEventsModal from '@/components/member/UpcomingEventsModal';
import RSVPModal from '@/components/member/RSVPModal';

export default function MemberDashboardPage() {
  const router = useRouter();
  const { member, loading } = useMemberAuth();

  const formatPhone = (phone?: string) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '').slice(-10);
    if (cleaned.length !== 10) return phone;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  };

  // Debug: Log member data when it changes
  useEffect(() => {
    if (member) {
      console.log('[DASHBOARD] Member data received:', {
        member_id: member.member_id,
        first_name: member.first_name,
        last_name: member.last_name,
        profile_photo_url: member.profile_photo_url,
        has_photo: !!member.profile_photo_url,
        photo_value: member.profile_photo_url || 'NULL/UNDEFINED',
        full_member: member
      });

      // Debug: Check what's actually in the database
      fetch('/api/debug/member-photo', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          console.log('[DASHBOARD] Database debug info:', data);
        })
        .catch(err => console.error('[DASHBOARD] Debug fetch error:', err));
    }
  }, [member]);
  const [nextReservation, setNextReservation] = useState<any>(null);
  const [loadingReservation, setLoadingReservation] = useState(true);
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
  const [isReservationsListModalOpen, setIsReservationsListModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isUpcomingEventsModalOpen, setIsUpcomingEventsModalOpen] = useState(false);
  const [isRSVPModalOpen, setIsRSVPModalOpen] = useState(false);
  const [selectedRSVPUrl, setSelectedRSVPUrl] = useState<string>('');
  const [mounted, setMounted] = useState(false);
  const [baseDays, setBaseDays] = useState<number[]>([]);
  const [bookingStartDate, setBookingStartDate] = useState<Date | undefined>(undefined);
  const [bookingEndDate, setBookingEndDate] = useState<Date | undefined>(undefined);
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [pastVisits, setPastVisits] = useState<any[]>([]);
  const [nextEvent, setNextEvent] = useState<any>(null);
  const [upcomingEventsCount, setUpcomingEventsCount] = useState<number>(0);
  const [accountMembers, setAccountMembers] = useState<any[]>([]);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);

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
    fetchUpcomingEvents();
    fetchAccountMembers();
    fetchSubscriptionData();
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

  const fetchUpcomingEvents = async () => {
    try {
      const response = await fetch('/api/noir-member-events', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const events = data.events || [];
        const now = new Date();

        // Get upcoming events (from now onwards)
        const upcoming = events.filter(
          (e: any) => new Date(e.start_time) >= now
        );

        // Set the next upcoming event
        setNextEvent(upcoming[0] || null);

        // Count events in current month
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const thisMonthEvents = upcoming.filter((e: any) => {
          const eventDate = new Date(e.start_time);
          return eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear;
        });
        setUpcomingEventsCount(thisMonthEvents.length);
      }
    } catch (error) {
      console.error('Error fetching upcoming events:', error);
    }
  };

  const fetchAccountMembers = async () => {
    try {
      const response = await fetch('/api/member/account-members', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const members = data.members || [];
        setAccountMembers(members);

        // Count only secondary members (matching admin logic)
        const secondaryMembers = members.filter((m: any) => m.member_type === 'secondary');
        console.log('Secondary members:', secondaryMembers.length, 'Total members:', members.length);
      }
    } catch (error) {
      console.error('Error fetching account members:', error);
    }
  };

  const fetchSubscriptionData = async () => {
    try {
      const response = await fetch('/api/member/account-subscription', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setSubscriptionData({
          ...data.subscription,
          baseMRR: data.baseMRR,
          secondaryMemberCount: data.secondaryMemberCount,
        });
      }
    } catch (error) {
      console.error('Error fetching subscription data:', error);
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
    <div className="min-h-screen bg-[#ECEDE8] relative">
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

          {/* Profile Card - Moved to Top */}
          <Card
            className="bg-white rounded-2xl border border-[#ECEAE5] shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
            onClick={() => setIsProfileModalOpen(true)}
          >
            <CardHeader className="pb-0">
              <CardTitle className="flex items-center gap-3">
                <User className="w-5 h-5 text-[#A59480]" />
                <span className="text-xl font-semibold text-[#1F1F1F]">
                  Profile
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-1 pb-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-lg font-medium text-[#1F1F1F]">
                    {member?.first_name} {member?.last_name}
                  </p>
                  <p className="text-sm text-[#5A5A5A]">{member?.email}</p>
                  <p className="text-sm text-[#5A5A5A]">{formatPhone(member?.phone)}</p>
                </div>
                <div className="w-40 h-40 -mt-8 bg-[#A59480] text-white rounded-full flex items-center justify-center text-4xl font-bold overflow-hidden flex-shrink-0 border-4 border-white shadow-lg">
                  {(member?.photo || member?.profile_photo_url) ? (
                    <img src={(member.photo || member.profile_photo_url) ?? undefined} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <>{member?.first_name?.charAt(0)}{member?.last_name?.charAt(0)}</>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Next Reservation Card */}
            <Card
              className="bg-white rounded-2xl border border-[#ECEAE5] shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
              onClick={() => setIsReservationsListModalOpen(true)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-[#A59480]" />
                    <span className="text-xl font-semibold text-[#1F1F1F]">
                      Reservations
                    </span>
                  </div>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsReservationModalOpen(true);
                    }}
                    className="bg-[#A59480] text-white hover:bg-[#8C7C6D] h-8 text-xs px-3"
                  >
                    Book Now
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 pt-0 pb-4">
                {loadingReservation ? (
                  <div className="flex justify-center py-8">
                    <Spinner className="text-[#A59480]" />
                  </div>
                ) : (
                  <>
                    {/* Next Reservation - One Line OR Make Reservation Button */}
                    {nextReservation ? (
                      <div
                        className="flex items-center justify-between gap-3 py-1 border-b border-[#ECEAE5] cursor-pointer hover:bg-[#FBFBFA]"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsReservationsListModalOpen(true);
                        }}
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
                    ) : (
                      <Button
                        className="w-full bg-[#A59480] text-white hover:bg-[#8C7C6D]"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsReservationModalOpen(true);
                        }}
                      >
                        Make Reservation
                      </Button>
                    )}

                    {/* Past Visits Preview */}
                    {pastVisits.map((visit, index) => (
                      <div
                        key={visit.id || index}
                        className="flex items-center justify-between gap-3 py-1 border-b border-[#ECEAE5] last:border-0 cursor-pointer hover:bg-[#FBFBFA]"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsReservationsListModalOpen(true);
                        }}
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
                  </>
                )}
              </CardContent>
            </Card>

            {/* Balance Card */}
            <Card
              className="bg-white rounded-2xl border border-[#ECEAE5] shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
              onClick={() => setIsBalanceModalOpen(true)}
            >
              <CardHeader className="pb-2">
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
              <CardContent className="space-y-0 pt-0 pb-4">
                {/* Recent Transactions Preview */}
                {recentTransactions.length > 0 ? (
                  <>
                    {recentTransactions.map((transaction, index) => (
                      <div
                        key={transaction.id || index}
                        className="flex items-center justify-between gap-3 py-1 border-b border-[#ECEAE5] last:border-0"
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
                  </>
                ) : (
                  <p className="text-sm text-[#5A5A5A] text-center py-4">No recent transactions</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Additional Dashboard Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Subscription Card */}
            <Card
              className="bg-white rounded-2xl border border-[#ECEAE5] shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
              onClick={() => setIsSubscriptionModalOpen(true)}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-[#A59480]" />
                  <span className="text-xl font-semibold text-[#1F1F1F]">
                    Subscription
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="bg-[#F6F5F2] rounded-lg p-3">
                  {(() => {
                    // Use API-provided values (matching admin logic exactly)
                    const baseMRR = subscriptionData?.baseMRR || 0;
                    const secondaryMemberCount = subscriptionData?.secondaryMemberCount || 0;
                    const additionalMemberFees = secondaryMemberCount * 25;
                    const total = baseMRR + additionalMemberFees;

                    return (
                      <>
                        {/* Base + Additional Members breakdown */}
                        <div className="space-y-1 mb-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[#8C7C6D]">Base Subscription</span>
                            <span className="text-[#5A5A5A] font-medium">${baseMRR.toFixed(2)}/mo</span>
                          </div>
                          {secondaryMemberCount > 0 && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-[#8C7C6D]">Additional Members ({secondaryMemberCount} × $25)</span>
                              <span className="text-[#5A5A5A] font-medium">${additionalMemberFees.toFixed(2)}/mo</span>
                            </div>
                          )}
                        </div>

                        {/* Total */}
                        <div className="flex items-center justify-between pt-2 border-t border-[#E8E6E1]">
                          <p className="text-sm font-semibold text-[#1F1F1F]">Total</p>
                          <p className="text-xl font-bold text-[#1F1F1F]">${total.toFixed(2)}/mo</p>
                        </div>
                      </>
                    );
                  })()}

                  <div className="flex items-center justify-between text-xs text-[#5A5A5A] pt-2 border-t border-[#E8E6E1]">
                    <span>{accountMembers.length} {accountMembers.length === 1 ? 'Member' : 'Members'}</span>
                    <Badge className={`text-white text-xs ${
                      subscriptionData?.subscription_status === 'active' ? 'bg-[#4CAF50]' :
                      subscriptionData?.subscription_status === 'past_due' ? 'bg-[#FF9800]' :
                      subscriptionData?.subscription_status === 'canceled' ? 'bg-[#F44336]' :
                      'bg-[#4CAF50]'
                    }`}>
                      {subscriptionData?.subscription_status ?
                        subscriptionData.subscription_status.charAt(0).toUpperCase() + subscriptionData.subscription_status.slice(1).replace('_', ' ')
                        : 'Active'}
                    </Badge>
                  </div>

                  {subscriptionData?.payment_method_last4 && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#E8E6E1]">
                      <CreditCard className="w-3 h-3 text-[#8C7C6D]" />
                      <p className="text-xs text-[#5A5A5A]">
                        {subscriptionData.payment_method_type === 'card' ? (
                          <>{subscriptionData.payment_method_brand} •••• {subscriptionData.payment_method_last4}</>
                        ) : (
                          <>Bank •••• {subscriptionData.payment_method_last4}</>
                        )}
                      </p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-[#8C7C6D]">Click to manage subscription & members</p>
              </CardContent>
            </Card>

            {/* Upcoming Events Card */}
            <Card
              className="bg-white rounded-2xl border border-[#ECEAE5] shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
              onClick={() => setIsUpcomingEventsModalOpen(true)}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <CalendarDays className="w-5 h-5 text-[#A59480]" />
                  <span className="text-xl font-semibold text-[#1F1F1F]">
                    Calendar
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {nextEvent ? (
                  <div className="space-y-2">
                    <div className="bg-[#F6F5F2] rounded-lg p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-[#8C7C6D] mb-1">Next Event</p>
                          <p className="text-sm font-medium text-[#1F1F1F] truncate">{nextEvent.title}</p>
                        </div>
                        {nextEvent.rsvpEnabled && nextEvent.rsvpUrl && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRSVPUrl(nextEvent.rsvpUrl);
                              setIsRSVPModalOpen(true);
                            }}
                            className="flex-shrink-0 h-8 px-4 flex items-center justify-center text-xs font-bold text-white bg-[#A59480] hover:bg-[#8C7C6D] rounded-lg transition-colors"
                          >
                            RSVP
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-[#5A5A5A]">
                        {new Date(nextEvent.start_time).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric'
                        })} at {new Date(nextEvent.start_time).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </p>
                    </div>
                    <p className="text-xs text-[#8C7C6D]">
                      {upcomingEventsCount} {upcomingEventsCount === 1 ? 'event' : 'events'} this month
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="bg-[#F6F5F2] rounded-lg p-3">
                      <p className="text-sm text-[#5A5A5A] text-center py-2">No upcoming events</p>
                    </div>
                    <p className="text-xs text-[#8C7C6D]">Check back later for new events</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

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

      {/* Profile Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

      {/* Payment Method Modal */}
      {/* Subscription Modal */}
      <SubscriptionModal
        isOpen={isSubscriptionModalOpen}
        onClose={() => {
          setIsSubscriptionModalOpen(false);
          // Refresh data after modal closes
          fetchAccountMembers();
          fetchSubscriptionData();
        }}
        accountId={member?.account_id}
      />

      {/* Upcoming Events Modal */}
      <UpcomingEventsModal
        isOpen={isUpcomingEventsModalOpen}
        onClose={() => setIsUpcomingEventsModalOpen(false)}
        onMakeReservation={() => {
          setIsUpcomingEventsModalOpen(false);
          setIsReservationModalOpen(true);
        }}
        onRSVP={(rsvpUrl) => {
          setSelectedRSVPUrl(rsvpUrl);
          setIsRSVPModalOpen(true);
        }}
      />

      {/* RSVP Modal */}
      <RSVPModal
        isOpen={isRSVPModalOpen}
        onClose={() => {
          setIsRSVPModalOpen(false);
          setSelectedRSVPUrl('');
        }}
        rsvpUrl={selectedRSVPUrl}
      />
    </div>
  );
}
