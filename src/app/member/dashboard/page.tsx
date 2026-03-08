"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Calendar, Clock, Wallet, User, List, ArrowUpIcon, ArrowDownIcon, CreditCard, CalendarDays, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemberAuth } from '@/context/MemberAuthContext';
import { getSupabaseClient } from '@/pages/api/supabaseClient';
import BalanceModal from '@/components/member/BalanceModal';
import ReservationsModal from '@/components/member/ReservationsModal';
import ProfileModal from '@/components/member/ProfileModal';
import SubscriptionModal from '@/components/member/SubscriptionModal';
import UpcomingEventsModal from '@/components/member/UpcomingEventsModal';
import RSVPModal from '@/components/member/RSVPModal';
import SimpleReservationRequestModal from '@/components/member/SimpleReservationRequestModal';

export default function MemberDashboardPage() {
  const router = useRouter();
  const { member, loading } = useMemberAuth();

  const formatPhone = (phone?: string) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '').slice(-10);
    if (cleaned.length !== 10) return phone;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  };

  // Helper to parse date strings without timezone conversion
  // Date-only strings from DB should be treated as local dates, not UTC
  const parseLocalDate = (dateString: string) => {
    if (!dateString) return new Date();
    // Parse date string manually to avoid timezone issues
    // Split by 'T' first to handle both timestamps and date-only strings
    const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
    return new Date(year, month - 1, day);
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
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [pastVisits, setPastVisits] = useState<any[]>([]);
  const [nextEvent, setNextEvent] = useState<any>(null);
  const [upcomingEventsCount, setUpcomingEventsCount] = useState<number>(0);
  const [upcomingEventsThisMonth, setUpcomingEventsThisMonth] = useState<any[]>([]);
  const [accountMembers, setAccountMembers] = useState<any[]>([]);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [copiedReferralLink, setCopiedReferralLink] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCopyReferralLink = async () => {
    if (!member?.referral_code) return;

    const referralLink = `https://noirkc.com/refer/${member.referral_code}`;

    try {
      await navigator.clipboard.writeText(referralLink);
      setCopiedReferralLink(true);
      setTimeout(() => setCopiedReferralLink(false), 2000);
    } catch (err) {
      console.error('Failed to copy referral link:', err);
    }
  };

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

        console.log('[RESERVATIONS] Total fetched:', reservations.length);
        console.log('[RESERVATIONS] Current time:', now);

        // Get all upcoming reservations (sorted soonest first)
        const upcoming = reservations
          .filter((r: any) => {
            const startTime = new Date(r.start_time);
            const isUpcoming = startTime >= now && r.status !== 'cancelled';
            console.log('[RESERVATIONS]', startTime, isUpcoming ? 'UPCOMING' : 'PAST', r.private_events?.title || 'Table reservation');
            return isUpcoming;
          })
          .sort((a: any, b: any) => {
            // Sort upcoming by start_time ASC (soonest first)
            return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
          });

        console.log('[RESERVATIONS] Upcoming count:', upcoming.length);

        // Store up to 5 upcoming reservations
        setNextReservation(upcoming.length > 0 ? { isMultiple: true, all: upcoming.slice(0, 5) } : null);

        // Don't show past visits on the card
        setPastVisits([]);
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
      // Fetch all private events and member's reservations
      const [privateEventsResponse, reservationsResponse] = await Promise.all([
        fetch('/api/member/private-events', { credentials: 'include' }),
        fetch('/api/member/reservations', { credentials: 'include' })
      ]);

      const now = new Date();
      const eventMap = new Map<string, any>(); // Use map to deduplicate by ID
      const rsvpdEventIds = new Set<string>();

      // Get reservations to track which events the member has RSVP'd to
      let reservations: any[] = [];
      if (reservationsResponse.ok) {
        const reservationsData = await reservationsResponse.json();
        reservations = reservationsData.reservations || [];

        // Track which events the member has RSVP'd to (exclude cancelled)
        // Note: undefined/null status means 'confirmed' (old reservations before status was added)
        reservations.forEach((r: any) => {
          if (r.private_event_id && r.status !== 'cancelled') {
            rsvpdEventIds.add(r.private_event_id);
          }
        });
      }

      // Get all private events
      if (privateEventsResponse.ok) {
        const privateData = await privateEventsResponse.json();
        (privateData.events || []).forEach((e: any) => {
          // If is_member_event is true, show real details, otherwise show "Private Event"
          const shouldShowDetails = e.is_member_event === true;
          eventMap.set(e.id, {
            ...e,
            eventType: 'private',
            displayTitle: shouldShowDetails ? e.title : 'Private Event',
            title: shouldShowDetails ? e.title : 'Private Event',
            isVisible: shouldShowDetails, // Track if event details are visible to member
            hasRSVPd: rsvpdEventIds.has(e.id),
            canRSVP: shouldShowDetails && e.rsvp_enabled === true,
            showDash: shouldShowDetails && e.rsvp_enabled === false,
            rsvpUrl: shouldShowDetails ? e.rsvp_url : null,
          });
        });
      }

      // Convert map to array and filter/sort
      const allEvents = Array.from(eventMap.values());

      // Filter for upcoming events and sort by start time
      const upcoming = allEvents
        .filter((e: any) => new Date(e.start_time) >= now)
        .sort((a: any, b: any) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

      // Set the next upcoming event
      setNextEvent(upcoming[0] || null);

      // Get events in current month
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const thisMonthEvents = upcoming.filter((e: any) => {
        const eventDate = new Date(e.start_time);
        return eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear;
      });
      setUpcomingEventsCount(thisMonthEvents.length);
      setUpcomingEventsThisMonth(thisMonthEvents);
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
    // Refresh the next reservation and balance after creating a new one
    fetchNextReservation();
    fetchCurrentBalance();
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
              <div className="flex items-start gap-4">
                <div className="flex-1 space-y-1">
                  <p className="text-lg font-medium text-[#1F1F1F]">
                    {member?.first_name} {member?.last_name}
                  </p>
                  <p className="text-sm text-[#5A5A5A]">{member?.email}</p>
                  <p className="text-sm text-[#5A5A5A]">{formatPhone(member?.phone)}</p>
                </div>
                <div className="-mt-10 w-32 h-32 sm:w-40 sm:h-40 bg-[#A59480] text-white rounded-full flex items-center justify-center text-4xl font-bold overflow-hidden flex-shrink-0 border-4 border-white shadow-lg">
                  {member?.profile_photo_url ? (
                    <img src={member.profile_photo_url} alt="Profile" className="w-full h-full object-cover" />
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
                      My Reservations
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
                    {(nextReservation || pastVisits.length > 0) ? (
                      <>
                        {/* Column Headers */}
                        <div className="grid grid-cols-[50px_1fr_60px_50px] gap-2 py-1 border-b border-[#ECEAE5]">
                          <p className="text-[10px] font-semibold text-[#8C7C6D] uppercase">Date</p>
                          <p className="text-[10px] font-semibold text-[#8C7C6D] uppercase">Event</p>
                          <p className="text-[10px] font-semibold text-[#8C7C6D] uppercase text-right">Time</p>
                          <p className="text-[10px] font-semibold text-[#8C7C6D] uppercase text-center">Guests</p>
                        </div>

                        {/* All Upcoming Reservations (up to 5) */}
                        {nextReservation?.all?.map((reservation: any, index: number) => (
                          <div
                            key={reservation.id || index}
                            className="grid grid-cols-[50px_1fr_60px_50px] gap-2 py-1 border-b border-[#ECEAE5] last:border-0 cursor-pointer hover:bg-[#FBFBFA]"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsReservationsListModalOpen(true);
                            }}
                          >
                            <p className="text-xs text-[#8C7C6D]">
                              {new Date(reservation.start_time).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </p>
                            <p className="text-xs font-medium text-[#1F1F1F] truncate">
                              {(reservation.private_events?.title || reservation.special_requests || 'Reservation').substring(0, 38)}
                              {((reservation.private_events?.title || reservation.special_requests || 'Reservation').length > 38) ? '...' : ''}
                            </p>
                            <p className="text-xs text-[#5A5A5A] text-right">
                              {(() => {
                                const time = new Date(reservation.start_time).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true,
                                });
                                return time.replace(' PM', ' P').replace(' AM', ' A');
                              })()}
                            </p>
                            <p className="text-xs text-[#5A5A5A] text-center">
                              {reservation.party_size}
                            </p>
                          </div>
                        ))}

                        {/* Past Visits Preview - HIDDEN */}
                        {pastVisits.map((visit, index) => (
                          <div
                            key={visit.id || index}
                            className="grid grid-cols-[50px_1fr_60px_50px] gap-2 py-1 border-b border-[#ECEAE5] last:border-0 cursor-pointer hover:bg-[#FBFBFA]"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsReservationsListModalOpen(true);
                            }}
                          >
                            <p className="text-xs text-[#8C7C6D]">
                              {new Date(visit.start_time).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </p>
                            <p className="text-xs text-[#5A5A5A] truncate">
                              {(visit.private_events?.title || visit.special_requests || 'Visit').substring(0, 38)}
                              {((visit.private_events?.title || visit.special_requests || 'Visit').length > 38) ? '...' : ''}
                            </p>
                            <p className="text-xs text-[#5A5A5A] text-right">
                              {(() => {
                                const time = new Date(visit.start_time).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true,
                                });
                                return time.replace(' PM', ' P').replace(' AM', ' A');
                              })()}
                            </p>
                            <p className="text-xs text-[#5A5A5A] text-center">
                              {visit.party_size}
                            </p>
                          </div>
                        ))}
                      </>
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
                          {parseLocalDate(transaction.created_at).toLocaleDateString('en-US', {
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
            {/* Membership Card */}
            <Card
              className="bg-white rounded-2xl border border-[#ECEAE5] shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
              onClick={() => setIsSubscriptionModalOpen(true)}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-[#A59480]" />
                  <span className="text-xl font-semibold text-[#1F1F1F]">
                    Membership
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Referral Link */}
                {member?.referral_code && (
                  <a
                    href={`sms:?&body=Join me at NOIR KC! Use my referral link: https://noirkc.com/refer/${member.referral_code}`}
                    onClick={(e) => e.stopPropagation()}
                    className="block bg-gradient-to-r from-[#A59480] to-[#8C7C6D] hover:from-[#8C7C6D] hover:to-[#7A6B5D] text-white rounded-lg p-4 transition-all shadow-[0_4px_12px_rgba(0,0,0,0.3)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.4)]"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <p className="text-2xl" style={{ fontFamily: 'CONEBARS' }}>Share Noir</p>
                      <p className="text-xs font-normal">(click here to send text)</p>
                      <p className="text-[10px] font-normal"><span className="font-bold">Referral Link:</span> noirkc.com/refer/{member.referral_code}</p>
                    </div>
                  </a>
                )}
                <div className="bg-[#F6F5F2] rounded-lg p-3">
                  {(() => {
                    // Use API-provided values - everything from database
                    const baseMRR = subscriptionData?.baseMRR || 0;
                    const secondaryMemberCount = subscriptionData?.secondaryMemberCount || 0;
                    const additionalMemberFee = subscriptionData?.additionalMemberFee || 0; // $0 for Skyline, $25 for Solo/Duo
                    const additionalMemberFees = secondaryMemberCount * additionalMemberFee;
                    const total = baseMRR + additionalMemberFees;

                    return (
                      <>
                        {/* Base + Additional Members breakdown */}
                        <div className="space-y-1 mb-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[#8C7C6D]">Base Membership</span>
                            <span className="text-[#5A5A5A] font-medium">${baseMRR.toFixed(2)}/mo</span>
                          </div>
                          {secondaryMemberCount > 0 && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-[#8C7C6D]">
                                Additional Members ({secondaryMemberCount} × ${additionalMemberFee.toFixed(0)})
                              </span>
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
                <p className="text-xs text-[#8C7C6D]">Click to manage membership & members</p>
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
                    Event Calendar
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0 pt-0 pb-4">
                {upcomingEventsThisMonth.length > 0 ? (
                  <>
                    {/* Column Headers */}
                    <div className="grid grid-cols-[48px_42px_1fr_55px] gap-2 py-2 border-b border-[#ECEAE5]">
                      <p className="text-[10px] font-semibold text-[#8C7C6D] uppercase">Date</p>
                      <p className="text-[10px] font-semibold text-[#8C7C6D] uppercase">Time</p>
                      <p className="text-[10px] font-semibold text-[#8C7C6D] uppercase">Event</p>
                      <p className="text-[10px] font-semibold text-[#8C7C6D] uppercase text-right">RSVP</p>
                    </div>

                    {/* Events List */}
                    {upcomingEventsThisMonth.map((event, index) => {
                      // Format time as "6-8P" or "6:30-8P"
                      const formatTime = (start: Date, end?: Date) => {
                        const startHour = start.getHours();
                        const startMin = start.getMinutes();
                        const startPeriod = startHour >= 12 ? 'P' : 'A';
                        const startHour12 = startHour % 12 || 12;

                        let startStr = `${startHour12}`;
                        if (startMin !== 0) {
                          startStr += `:${startMin.toString().padStart(2, '0')}`;
                        }

                        if (!end) return `${startStr}${startPeriod}`;

                        const endHour = end.getHours();
                        const endMin = end.getMinutes();
                        const endPeriod = endHour >= 12 ? 'P' : 'A';
                        const endHour12 = endHour % 12 || 12;

                        let endStr = `${endHour12}`;
                        if (endMin !== 0) {
                          endStr += `:${endMin.toString().padStart(2, '0')}`;
                        }

                        return `${startStr}-${endStr}${endPeriod}`;
                      };

                      return (
                        <div
                          key={event.id || index}
                          className="grid grid-cols-[48px_42px_1fr_55px] gap-2 py-2 border-b border-[#ECEAE5] last:border-0 hover:bg-[#FBFBFA] items-start"
                        >
                          <p className="text-xs text-[#8C7C6D] leading-tight">
                            {new Date(event.start_time).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                          <p className="text-xs text-[#5A5A5A] leading-tight">
                            {formatTime(
                              new Date(event.start_time),
                              event.end_time ? new Date(event.end_time) : undefined
                            )}
                          </p>
                          <p className="text-xs text-[#5A5A5A] truncate leading-tight">
                            {event.displayTitle || event.title}
                          </p>
                          <p className="text-xs text-right whitespace-nowrap leading-tight m-0">
                            {!event.isVisible ? (
                              <span className="text-[#8C7C6D]">Closed</span>
                            ) : event.hasRSVPd ? (
                              <span className="text-[#4CAF50]">RSVP'd</span>
                            ) : event.canRSVP && event.rsvpUrl ? (
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedRSVPUrl(event.rsvpUrl);
                                  setIsRSVPModalOpen(true);
                                }}
                                className="text-[#A59480] hover:text-[#8C7C6D] underline cursor-pointer"
                              >
                                RSVP
                              </span>
                            ) : event.showDash ? (
                              <span className="text-[#8C7C6D]">--</span>
                            ) : (
                              <span className="text-[#8C7C6D]">Closed</span>
                            )}
                          </p>
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-xs text-[#5A5A5A]">No upcoming events this month</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Reservation Request Modal */}
      <SimpleReservationRequestModal
        isOpen={isReservationModalOpen}
        onClose={() => {
          setIsReservationModalOpen(false);
        }}
        onReservationCreated={handleReservationCreated}
        memberName={member ? `${member.first_name} ${member.last_name}` : ''}
        memberPhone={member?.phone || ''}
        memberId={member?.member_id}
        accountId={member?.account_id}
      />

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
