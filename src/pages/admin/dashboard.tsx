import { Box, Heading, SimpleGrid, Stat, StatLabel, StatNumber, Spinner, VStack, Text, Flex, Button, useDisclosure } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import AdminLayout from '../../components/layouts/AdminLayout';
import WaitlistReviewDrawer from '../../components/WaitlistReviewDrawer';
import DashboardCard from '../../components/dashboard/DashboardCard';
import DashboardListCard from '../../components/dashboard/DashboardListCard';
import styles from '../../styles/Dashboard.module.css';
import Link from 'next/link';

interface Member {
  member_id: string;
  first_name: string;
  last_name: string;
  dob?: string;
  join_date?: string;
  monthly_dues?: number;
}

interface LedgerEntry {
  type: string;
  date: string;
  amount: number;
}

interface FinancialMetrics {
  monthlyRecurringRevenue: {
    total: number;
    breakdown: any[];
    description: string;
  };
  julyPaymentsReceived: {
    total: number;
    breakdown: any[];
    description: string;
  };
  julyRevenue: {
    total: number;
    breakdown: any[];
    description: string;
  };
  julyAR: {
    total: number;
    description: string;
    breakdown?: any[];
  };
  outstandingBalances: {
    total: number;
    breakdown: any[];
    description: string;
  };
}

interface Stats {
  members: Member[];
  ledger: LedgerEntry[];
  reservations: number;
  outstanding: number;
  loading: boolean;
  waitlistCount: number;
  waitlistEntries: any[];
  invitationRequestsCount: number;
  invitationRequests: any[];
  financialMetrics?: FinancialMetrics;
  privateEvents?: any[];
}

function getNextBirthday(dob?: string) {
  if (!dob) return null;
  const today = new Date();
  const [year, month, day] = dob.split('-').map(Number);
  let next = new Date(today.getFullYear(), month - 1, day);
  
  // If the birthday is today, return today's date
  if (next.getMonth() === today.getMonth() && next.getDate() === today.getDate()) {
    return today;
  }
  
  if (next < today) {
    next = new Date(today.getFullYear() + 1, month - 1, day);
  }
  return next;
}

// Utility: Get ISO week number (Monday as first day of week)
function getISOWeek(date: Date) {
  const temp = new Date(date.valueOf());
  const dayNum = (date.getDay() + 6) % 7;
  temp.setDate(temp.getDate() - dayNum + 3);
  const firstThursday = temp.valueOf();
  temp.setMonth(0, 1);
  if (temp.getDay() !== 4) {
    temp.setMonth(0, 1 + ((4 - temp.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - temp.valueOf()) / 604800000);
}

// Utility: Get Thursday/Friday/Saturday dates for a given ISO week
function getWeekDates(year: number, week: number) {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const monday = new Date(simple);
  if (dow <= 4) {
    monday.setDate(simple.getDate() - simple.getDay() + 1);
  } else {
    monday.setDate(simple.getDate() + 8 - simple.getDay());
  }
  // Thursday = monday + 3, Friday = monday + 4, Saturday = monday + 5
  return [3, 4, 5].map(offset => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + offset);
    return d;
  });
}

// Utility to get the next occurrence of a weekday (0=Sunday, 1=Monday, ...)
function getNextWeekdayDate(weekday: number) {
  const today = new Date();
  const result = new Date(today);
  result.setHours(0, 0, 0, 0);
  const diff = (weekday + 7 - today.getDay()) % 7 || 7;
  result.setDate(today.getDate() + diff);
  return result;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    members: [],
    ledger: [],
    reservations: 0,
    outstanding: 0,
    loading: true,
    waitlistCount: 0,
    waitlistEntries: [],
    invitationRequestsCount: 0,
    invitationRequests: [],
    privateEvents: [],
  });
  const [reservationDetails, setReservationDetails] = useState<any[]>([]);
  const [selectedWaitlistEntry, setSelectedWaitlistEntry] = useState<any>(null);
  const { isOpen: isWaitlistModalOpen, onOpen: onWaitlistModalOpen, onClose: onWaitlistModalClose } = useDisclosure();

  const fetchStats = async () => {
    setStats(s => ({ ...s, loading: true }));
    
    // Helper function to safely fetch and parse JSON
    const safeFetch = async (url: string, options: RequestInit = {}) => {
      try {
        const response = await fetch(url, options);
        if (!response.ok) {
          const errorText = await response.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText || `HTTP ${response.status}` };
          }
          console.error(`API error for ${url}:`, errorData);
          return { error: errorData.error || `Failed to fetch ${url}` };
        }
        return await response.json();
      } catch (error) {
        console.error(`Network error for ${url}:`, error);
        return { error: error instanceof Error ? error.message : 'Network error' };
      }
    };

    try {
      // Fetch all APIs in parallel with individual error handling
      const [
        membersResult,
        ledgerResult,
        reservationsResult,
        outstandingResult,
        financialResult,
        waitlistResult,
        waitlistedResult,
        privateEventsResult
      ] = await Promise.all([
        safeFetch("/api/members"),
        safeFetch("/api/ledger"),
        safeFetch("/api/reservations?upcoming=1"),
        safeFetch("/api/ledger?outstanding=1"),
        safeFetch("/api/financial-metrics"),
        safeFetch("/api/waitlist?status=review&limit=5"),
        safeFetch("/api/waitlist?status=waitlisted&limit=5"),
        (async () => {
          const now = new Date();
          const startDate = now.toISOString();
          const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
          return safeFetch(`/api/private-events?startDate=${startDate}&endDate=${endDate}`);
        })()
      ]);

      // Extract data, using empty defaults if there was an error
      // Handle both ApiResponse format ({ success: true, data }) and direct format ({ data })
      const membersData = membersResult.error || membersResult.success === false
        ? { data: [] }
        : membersResult.success === true
        ? membersResult  // ApiResponse format: { success: true, data: [...] }
        : { data: membersResult.data || membersResult || [] };  // Direct format: { data: [...] } or just array
      
      const ledgerData = ledgerResult.error || ledgerResult.success === false
        ? { data: [] }
        : ledgerResult.success === true
        ? ledgerResult
        : { data: ledgerResult.data || ledgerResult || [] };
      
      const reservationsData = reservationsResult.error || reservationsResult.success === false
        ? { count: 0, data: [] }
        : reservationsResult.success === true
        ? reservationsResult
        : { count: reservationsResult.count || 0, data: reservationsResult.data || [] };
      
      const outstandingData = outstandingResult.error || outstandingResult.success === false
        ? { total: 0 }
        : outstandingResult.success === true
        ? outstandingResult
        : { total: outstandingResult.total || 0 };
      
      const financialData = financialResult.error || financialResult.success === false
        ? {}
        : financialResult.success === true
        ? financialResult.data || financialResult
        : financialResult;
      
      const waitlistData = waitlistResult.error || waitlistResult.success === false
        ? { count: 0, data: [] }
        : waitlistResult.success === true
        ? waitlistResult
        : { count: waitlistResult.count || 0, data: waitlistResult.data || [] };
      
      const waitlistedData = waitlistedResult.error || waitlistedResult.success === false
        ? { count: 0, data: [] }
        : waitlistedResult.success === true
        ? waitlistedResult
        : { count: waitlistedResult.count || 0, data: waitlistedResult.data || [] };
      
      const privateEventsData = privateEventsResult.error || privateEventsResult.success === false
        ? { data: [] }
        : privateEventsResult.success === true
        ? privateEventsResult
        : { data: privateEventsResult.data || [] };
      
      setStats({
        members: membersData.data || [],
        ledger: ledgerData.data || [],
        reservations: reservationsData.count || 0,
        outstanding: outstandingData.total || 0,
        loading: false,
        waitlistCount: waitlistedData.count || 0,
        waitlistEntries: waitlistedData.data || [],
        invitationRequestsCount: waitlistData.count || 0,
        invitationRequests: waitlistData.data || [],
        financialMetrics: financialData,
        privateEvents: privateEventsData.data || [],
      });
      setReservationDetails(reservationsData.data || []);
    } catch (err) {
      console.error('Error fetching stats:', err);
      setStats({ members: [], ledger: [], reservations: 0, outstanding: 0, loading: false, waitlistCount: 0, waitlistEntries: [], invitationRequestsCount: 0, invitationRequests: [], privateEvents: [] });
      setReservationDetails([]);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (stats.loading) {
    return (
      <Box p={4}><Spinner size="xl" /></Box>
    );
  }

  // Total Members and Dues
  const totalMembers = stats.members.length;
  const totalDues = stats.members.reduce((sum, m) => sum + (m.monthly_dues || 0), 0);

  // Current Month Finances
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const isThisMonth = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  };
  const payments = stats.ledger.filter(tx => tx.type === 'payment' && isThisMonth(tx.date)).reduce((sum, tx) => sum + Number(tx.amount), 0);
  const purchases = stats.ledger.filter(tx => tx.type === 'purchase' && isThisMonth(tx.date)).reduce((sum, tx) => sum + Number(tx.amount), 0);
  const ar = Math.abs(purchases) - payments;

  // Next 5 Birthdays (including today's birthdays)
  const membersWithBirthday = stats.members.filter(m => m.dob).map(m => ({
    ...m,
    nextBirthday: getNextBirthday(m.dob)
  })).filter(m => m.nextBirthday).sort((a, b) => {
    const aDate = a.nextBirthday as Date;
    const bDate = b.nextBirthday as Date;
    const today = new Date();
    
    // Check if either birthday is today
    const aIsToday = aDate.getMonth() === today.getMonth() && aDate.getDate() === today.getDate();
    const bIsToday = bDate.getMonth() === today.getMonth() && bDate.getDate() === today.getDate();
    
    // Today's birthdays come first
    if (aIsToday && !bIsToday) return -1;
    if (!aIsToday && bIsToday) return 1;
    
    // Then sort by date
    return aDate.getTime() - bDate.getTime();
  }).slice(0, 5);

  // Next 5 Payments Due (Upcoming Renewals)
  const getNextRenewal = (member: Member) => {
    if (!member.join_date) return null;
    const jd = new Date(member.join_date);
    const today = new Date();
    let year = today.getFullYear();
    let month = today.getMonth();
    const day = jd.getDate();
    let candidate = new Date(year, month, day);
    if (candidate < today) {
      if (month === 11) { year += 1; month = 0; }
      else { month += 1; }
      candidate = new Date(year, month, day);
    }
    return candidate;
  };
  const membersWithRenewal = stats.members.map(m => ({
    ...m,
    nextRenewal: getNextRenewal(m)
  })).filter(m => m.nextRenewal).sort((a, b) => (a.nextRenewal as Date).getTime() - (b.nextRenewal as Date).getTime()).slice(0, 5);

  // Calculate seat totals for next Thursday (4), Friday (5), Saturday (6)
  // Use ISO week logic for "Reservations for Noir" component
  const today = new Date();
  let year = today.getFullYear();
  let week = getISOWeek(today);
  if (today.getDay() === 0) { // Sunday
    week += 1;
    // Handle year rollover
    if (week > getISOWeek(new Date(year, 11, 31))) {
      week = 1;
      year += 1;
    }
  }
  const [nextThursday, nextFriday, nextSaturday] = getWeekDates(year, week);

  function isSameDay(date1: Date, date2: Date) {
    return date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate();
  }

  // Get private events for each day
  const getPrivateEventForDay = (date: Date) => {
    return stats.privateEvents?.find(event => {
      const eventDate = new Date(event.start_time);
      return isSameDay(eventDate, date);
    });
  };

  const thursdayReservations = reservationDetails.filter(r => {
    const d = new Date(r.start_time);
    return isSameDay(d, nextThursday);
  });
  const thursdaySeats = thursdayReservations.reduce((sum, r) => sum + (Number(r.party_size) || 0), 0);
  const thursdayPrivateEvent = getPrivateEventForDay(nextThursday);

  const fridayReservations = reservationDetails.filter(r => {
    const d = new Date(r.start_time);
    return isSameDay(d, nextFriday);
  });
  const fridaySeats = fridayReservations.reduce((sum, r) => sum + (Number(r.party_size) || 0), 0);
  const fridayPrivateEvent = getPrivateEventForDay(nextFriday);

  const saturdayReservations = reservationDetails.filter(r => {
    const d = new Date(r.start_time);
    return isSameDay(d, nextSaturday);
  });
  const saturdaySeats = saturdayReservations.reduce((sum, r) => sum + (Number(r.party_size) || 0), 0);
  const saturdayPrivateEvent = getPrivateEventForDay(nextSaturday);

  return (
    <AdminLayout>
      <div className={styles.dashboardRoot} >
        {/* Single-stat cards grid */}
        <div className={styles.cardsGrid}>
          <DashboardCard label="Total Members" value={totalMembers} />
          
          <DashboardCard 
            label="Monthly Memberships" 
            value={`$${stats.financialMetrics?.monthlyRecurringRevenue?.total?.toFixed(2) || totalDues.toFixed(2)}`}
            description={stats.financialMetrics?.monthlyRecurringRevenue?.description}
            breakdown={stats.financialMetrics?.monthlyRecurringRevenue?.breakdown}
            breakdownTitle="MRR Breakdown"
          />
          
          <DashboardCard 
            label="Outstanding Balances" 
            value={`$${stats.financialMetrics?.outstandingBalances?.total?.toFixed(2) || stats.outstanding?.toFixed(2)}`}
            description={stats.financialMetrics?.outstandingBalances?.description}
            breakdown={stats.financialMetrics?.outstandingBalances?.breakdown}
            breakdownTitle="Outstanding Balances"
          />
          
          <DashboardCard 
            label={`${now.toLocaleString('default', { month: 'long' })} Member Revenue`} 
            value={`$${stats.financialMetrics?.julyRevenue?.total?.toFixed(2) || Math.abs(purchases).toFixed(2)}`}
            description={stats.financialMetrics?.julyRevenue?.description}
            breakdown={stats.financialMetrics?.julyRevenue?.breakdown}
            breakdownTitle={`${now.toLocaleString('default', { month: 'long' })} Member Revenue`}
          />
          
          <DashboardCard 
            label={`${now.toLocaleString('default', { month: 'long' })} Toast Revenue`} 
            value={`$${stats.financialMetrics?.julyPaymentsReceived?.total?.toFixed(2) || payments.toFixed(2)}`}
            description={stats.financialMetrics?.julyPaymentsReceived?.description}
            breakdown={stats.financialMetrics?.julyPaymentsReceived?.breakdown}
            breakdownTitle={`${now.toLocaleString('default', { month: 'long' })} Toast Revenue`}
          />
          
          <DashboardCard 
            label={`${now.toLocaleString('default', { month: 'long' })} A/R (Owed to Us)`} 
            value={`$${stats.financialMetrics?.julyAR?.total?.toFixed(2) || ar.toFixed(2)}`}
            description={stats.financialMetrics?.julyAR?.description}
            breakdown={stats.financialMetrics?.julyAR?.breakdown}
            breakdownTitle={`${now.toLocaleString('default', { month: 'long' })} A/R Calculation`}
          />
          
          <DashboardCard label="Invitation Requests" value={stats.invitationRequestsCount} />
          <DashboardCard label="Waitlist" value={stats.waitlistCount} />
        </div>
        
        {/* Multi-data cards stacked below */}
        <div className={styles.listsGrid}>
          <DashboardListCard label="Reservations for Noir">
            <div className={styles.reservationList}>
              <div className={styles.weekDayItem}>
                <div className={styles.weekDayHeader}>
                  <strong>{nextThursday.toLocaleDateString(undefined, { weekday: 'long' })}</strong> - {nextThursday.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' })}
                </div>
                {thursdayPrivateEvent ? (
                  <div className={styles.privateEventName}>🔒 {thursdayPrivateEvent.title}</div>
                ) : thursdayReservations.length > 0 ? (
                  <Link href={`/admin/calendar?date=${nextThursday.toISOString().split('T')[0]}`} className={styles.weekDayItem}>
                    <div className={styles.reservationSummary}>
                      {thursdayReservations.length} Reservation{thursdayReservations.length !== 1 ? 's' : ''} & {thursdaySeats} Cover{thursdaySeats !== 1 ? 's' : ''}
                    </div>
                  </Link>
                ) : (
                  <div className={styles.noReservations}>No reservations</div>
                )}
              </div>
              <div className={styles.weekDayItem}>
                <div className={styles.weekDayHeader}>
                  <strong>{nextFriday.toLocaleDateString(undefined, { weekday: 'long' })}</strong> - {nextFriday.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' })}
                </div>
                {fridayPrivateEvent ? (
                  <div className={styles.privateEventName}>🔒 {fridayPrivateEvent.title}</div>
                ) : fridayReservations.length > 0 ? (
                  <Link href={`/admin/calendar?date=${nextFriday.toISOString().split('T')[0]}`} className={styles.weekDayItem}>
                    <div className={styles.reservationSummary}>
                      {fridayReservations.length} Reservation{fridayReservations.length !== 1 ? 's' : ''} & {fridaySeats} Cover{fridaySeats !== 1 ? 's' : ''}
                    </div>
                  </Link>
                ) : (
                  <div className={styles.noReservations}>No reservations</div>
                )}
              </div>
              <div className={styles.weekDayItem}>
                <div className={styles.weekDayHeader}>
                  <strong>{nextSaturday.toLocaleDateString(undefined, { weekday: 'long' })}</strong> - {nextSaturday.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit'})}
                </div>
                {saturdayPrivateEvent ? (
                  <div className={styles.privateEventName}>🔒 {saturdayPrivateEvent.title}</div>
                ) : saturdayReservations.length > 0 ? (
                  <Link href={`/admin/calendar?date=${nextSaturday.toISOString().split('T')[0]}`} className={styles.weekDayItem}>
                    <div className={styles.reservationSummary}>
                      {saturdayReservations.length} Reservation{saturdayReservations.length !== 1 ? 's' : ''} & {saturdaySeats} Cover{saturdaySeats !== 1 ? 's' : ''}
                    </div>
                  </Link>
                ) : (
                  <div className={styles.noReservations}>No reservations</div>
                )}
              </div>
            </div>
          </DashboardListCard>
          <DashboardListCard label="Upcoming Birthdays">
            {membersWithBirthday.length === 0 ? <div className={styles.noReservations}>No upcoming birthdays.</div> : (
              <div className={styles.reservationList}>
                {membersWithBirthday.map(m => {
                  const birthdayDate = m.nextBirthday as Date;
                  const today = new Date();
                  const isToday = birthdayDate.getMonth() === today.getMonth() && birthdayDate.getDate() === today.getDate();
                  
                  return (
                    <Link key={m.member_id} href={`/admin/members/${m.member_id}`} className={styles.weekDayItem}>
                      <div className={styles.weekDayHeader}>
                        <strong>{m.first_name} {m.last_name}</strong>
                        {isToday && <span style={{ color: '#BCA892', fontWeight: 'bold' }}> 🎉 TODAY!</span>}
                      </div>
                      <div className={styles.reservationSummary}>
                        🎂 {birthdayDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </DashboardListCard>
          <DashboardListCard label="Next 5 Payments Due">
            {membersWithRenewal.length === 0 ? <div className={styles.noReservations}>No upcoming payments.</div> : (
              <div className={styles.reservationList}>
                {membersWithRenewal.map(m => (
                  <Link key={m.member_id} href={`/admin/members/${m.member_id}`} className={styles.weekDayItem}>
                    <div className={styles.weekDayHeader}>
                      <strong>{m.first_name} {m.last_name}</strong>
                    </div>
                    <div className={styles.reservationSummary}>
                      💳 {(m.nextRenewal as Date).toLocaleDateString()} - <span className={styles.paymentAmount}>${(m.monthly_dues || 0).toFixed(2)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </DashboardListCard>
          <DashboardListCard label="Invitation Requests">
            {stats.invitationRequests.length === 0 ? (
              <div className={styles.noReservations}>No pending requests.</div>
            ) : (
              <div className={styles.reservationList}>
                {stats.invitationRequests.slice(0, 5).map((entry: any) => (
                  <Link key={entry.id} href="/admin/waitlist?status=review" className={styles.weekDayItem}>
                    <div className={styles.weekDayHeader}>
                      <strong>{entry.first_name} {entry.last_name}</strong>
                    </div>
                    <div className={styles.reservationSummary}>
                      📝 {new Date(entry.submitted_at).toLocaleDateString()}
                    </div>
                  </Link>
                ))}
                {stats.invitationRequests.length > 5 && (
                  <Link href="/admin/waitlist?status=review" className={styles.weekDayItem}>
                    <div className={styles.reservationSummary}>
                      +{stats.invitationRequests.length - 5} more requests
                    </div>
                  </Link>
                )}
              </div>
            )}
          </DashboardListCard>
          <DashboardListCard label="Waitlist">
            {stats.waitlistEntries.length === 0 ? (
              <div className={styles.noReservations}>No waitlist entries.</div>
            ) : (
              <div className={styles.reservationList}>
                {stats.waitlistEntries.slice(0, 5).map((entry: any) => (
                  <Link key={entry.id} href="/admin/waitlist?status=waitlisted" className={styles.weekDayItem}>
                    <div className={styles.weekDayHeader}>
                      <strong>{entry.first_name} {entry.last_name}</strong>
                    </div>
                    <div className={styles.reservationSummary}>
                      ⏳ {new Date(entry.submitted_at).toLocaleDateString()}
                    </div>
                  </Link>
                ))}
                {stats.waitlistEntries.length > 5 && (
                  <Link href="/admin/waitlist?status=waitlisted" className={styles.weekDayItem}>
                    <div className={styles.reservationSummary}>
                      +{stats.waitlistEntries.length - 5} more entries
                    </div>
                  </Link>
                )}
              </div>
            )}
          </DashboardListCard>
        </div>
        <WaitlistReviewDrawer
          isOpen={isWaitlistModalOpen}
          onClose={onWaitlistModalClose}
          entry={selectedWaitlistEntry}
          onStatusUpdate={fetchStats}
        />
      </div>
    </AdminLayout>
  );
} 